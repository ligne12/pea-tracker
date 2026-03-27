import { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart3, RefreshCw, Plus, Circle, Settings as SettingsIcon, User, Upload } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { KPICards } from '@/components/KPICards';
import { PriceChart } from '@/components/PriceChart';
import { DCAChart } from '@/components/DCAChart';
import { TransactionTable } from '@/components/TransactionTable';
import { TransactionForm } from '@/components/TransactionForm';
import { AllocationChart } from '@/components/AllocationChart';
import { Settings } from '@/components/Settings';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/hooks/useTheme';
import { parseBoursoFiles } from '@/lib/pdf-parser';
import { computeMetrics, computeDCAData } from '@/lib/calculations';
import {
  saveTransactions, loadTransactions, mergeTransactions,
  updateTransaction, deleteTransaction,
  exportData, importData, clearAllData,
} from '@/lib/storage';
import { useMarketData } from '@/hooks/useMarketData';
import { signInWithEmail, signOut, getUser, onAuthChange } from '@/lib/supabase';
import { syncAll, pushTransactions, deleteRemoteTransaction } from '@/lib/sync';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Transaction, PortfolioMetrics } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const { marketDataMap, marketPrices, marketStatus, getLastRefreshLabel, refresh, isMarketOpen } = useMarketData(transactions);

  // Load saved data on mount
  useEffect(() => {
    const saved = loadTransactions();
    if (saved.length > 0) setTransactions(saved);
  }, []);

  // Auth listener
  useEffect(() => {
    getUser().then(setUser);
    const { unsubscribe } = onAuthChange(setUser);
    return () => unsubscribe();
  }, []);

  // Auto-sync on login
  useEffect(() => {
    if (user) handleSync();
  }, [user]);

  const handleSync = useCallback(async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const { merged, pulled, pushed } = await syncAll(transactions, user.id);
      setTransactions(merged);
      saveTransactions(merged);
      setLastSync(Date.now());
      toast(`Sync OK — ${pulled} distant, ${pushed} envoyé${pushed > 1 ? 's' : ''}`, 'success');
    } catch {
      toast('Erreur de synchronisation', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [user, transactions, toast]);

  const handleSignIn = useCallback(async (email: string) => {
    const { error } = await signInWithEmail(email);
    if (error) toast(error, 'error');
  }, [toast]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setUser(null);
    toast('Déconnecté', 'info');
  }, [toast]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsLoading(true);
    try {
      const parsed = await parseBoursoFiles(files);
      const merged = mergeTransactions(transactions, parsed);
      const newCount = merged.length - transactions.length;
      setTransactions(merged);
      saveTransactions(merged);
      toast(`${parsed.length} PDF(s) analysé(s), ${newCount} nouvelle(s) transaction(s)`, 'success');
      await refresh(merged);
    } finally {
      setIsLoading(false);
    }
  }, [transactions, refresh]);

  const handleSaveTransaction = useCallback(async (txn: Transaction) => {
    let next: Transaction[];
    if (editingTxn) {
      next = updateTransaction(transactions, txn);
    } else {
      next = mergeTransactions(transactions, [txn]);
      saveTransactions(next);
    }
    setTransactions(next);
    setShowForm(false);
    setEditingTxn(null);
    toast(editingTxn ? 'Transaction modifiée' : 'Transaction ajoutée', 'success');
    if (user) pushTransactions([txn], user.id);
    refresh(next);
  }, [transactions, editingTxn, refresh, user, toast]);

  const handleEditTransaction = useCallback((txn: Transaction) => {
    setEditingTxn(txn);
    setShowForm(true);
  }, []);

  const handleDeleteTransaction = useCallback((id: string) => {
    const next = deleteTransaction(transactions, id);
    setTransactions(next);
    toast('Transaction supprimée', 'info');
    if (user) deleteRemoteTransaction(id);
  }, [transactions, user, toast]);

  const handleExport = useCallback(() => {
    exportData(transactions);
    toast('Backup exporté', 'success');
  }, [transactions, toast]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      const merged = mergeTransactions(transactions, imported);
      const newCount = merged.length - transactions.length;
      setTransactions(merged);
      saveTransactions(merged);
      toast(`${imported.length} transactions importées (${newCount} nouvelles)`, 'success');
      refresh(merged);
    } catch (err) {
      toast('Erreur lors de l\'import : ' + (err as Error).message, 'error');
    }
    e.target.value = '';
  }, [transactions, refresh]);

  const handleClearData = () => {
    if (window.confirm('Supprimer toutes les données ? Cette action est irréversible.')) {
      clearAllData();
      setTransactions([]);
    }
  };

  const metrics: PortfolioMetrics = computeMetrics(transactions, marketPrices, marketDataMap);
  const dcaData = computeDCAData(transactions);
  const hasData = transactions.length > 0;

  // Get market data for the first (or only) position
  const firstPosition = metrics.positions[0];
  const chartData = firstPosition ? (marketDataMap[firstPosition.isin] ?? []) : [];
  const chartTransactions = firstPosition
    ? transactions.filter(t => t.isin === firstPosition.isin)
    : [];

  // Market status indicator
  const statusColor = {
    open: 'text-emerald-400',
    closed: 'text-zinc-500',
    loading: 'text-amber-400',
    error: 'text-red-400',
  }[marketStatus];
  const statusLabel = {
    open: `Marché ouvert \u00B7 ${getLastRefreshLabel()}`,
    closed: `Marché fermé \u00B7 ${getLastRefreshLabel()}`,
    loading: 'Chargement des cours...',
    error: 'Erreur de connexion',
  }[marketStatus];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-zinc-50">PEA Tracker</h1>
              {hasData && (
                <div className="flex items-center gap-1.5 -mt-0.5">
                  <Circle className={cn('w-1.5 h-1.5 fill-current', statusColor)} />
                  <span className={cn('text-[10px]', statusColor)}>{statusLabel}</span>
                </div>
              )}
              {!hasData && <p className="text-[10px] text-zinc-600 -mt-0.5 hidden sm:block">BoursoBank</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasData && (
              <>
                {/* Add transaction */}
                <button
                  onClick={() => { setEditingTxn(null); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Ajouter</span>
                </button>

                {/* Import PDFs — same style as Ajouter */}
                <FileUpload onFilesSelected={handleFilesSelected} compact isLoading={isLoading} />

                {/* Refresh */}
                <button
                  onClick={() => refresh(transactions)}
                  disabled={marketStatus === 'loading'}
                  className={cn(
                    'p-1.5 rounded-lg transition-all',
                    'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800',
                    marketStatus === 'loading' && 'opacity-50'
                  )}
                  title="Rafraîchir les cours"
                >
                  <RefreshCw className={cn('w-4 h-4', marketStatus === 'loading' && 'animate-spin')} />
                </button>

                {/* Settings */}
                <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-zinc-800">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    title="Paramètres"
                  >
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {/* nothing here — slide panel is at the bottom of the component */}
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
                Bienvenue sur PEA Tracker
              </h2>
              <p className="text-zinc-500 max-w-md mx-auto">
                Importe tes avis d'opéré BoursoBank pour visualiser les performances de ton PEA.
              </p>
            </div>
            <div className="w-full max-w-lg">
              <FileUpload onFilesSelected={handleFilesSelected} isLoading={isLoading} />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => { setEditingTxn(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition-all"
              >
                <Plus className="w-4 h-4" /> Saisie manuelle
              </button>
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              <button
                onClick={() => importRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition-all"
              >
                <Upload className="w-4 h-4" /> Importer JSON
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <KPICards metrics={metrics} />

            {firstPosition && (
              <PriceChart
                marketData={chartData}
                transactions={chartTransactions}
                title={firstPosition.name}
              />
            )}

            {/* Allocation + DCA */}
            <AllocationChart positions={metrics.positions} />

            <DCAChart dcaData={dcaData} transactions={transactions} />

            <TransactionTable
              transactions={transactions}
              onEdit={handleEditTransaction}
              onDelete={handleDeleteTransaction}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>PEA Tracker</span>
            {hasData && (
              <span className="font-tabular">
                {transactions.length} transactions &middot; {metrics.positions.length} ligne{metrics.positions.length > 1 ? 's' : ''} &middot; Yahoo Finance
              </span>
            )}
          </div>
        </div>
      </footer>

      {/* Hidden import input */}
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

      {/* Transaction Form Modal */}
      {showForm && (
        <TransactionForm
          transaction={editingTxn}
          onSave={handleSaveTransaction}
          onClose={() => { setShowForm(false); setEditingTxn(null); }}
        />
      )}

      {/* Settings Panel */}
      <Settings
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onExport={handleExport}
        onImport={handleImport}
        onClear={handleClearData}
        transactionCount={transactions.length}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onSync={handleSync}
        isSyncing={isSyncing}
        lastSyncLabel={lastSync ? `Sync ${new Date(lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
      />

    </div>
  );
}
