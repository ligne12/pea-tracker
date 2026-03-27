import { useState, useRef } from 'react';
import { X, User, Sun, Moon, Download, Upload, Trash2, Database, RefreshCw, LogOut, Mail } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  transactionCount: number;
  user: SupabaseUser | null;
  onSignIn: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  lastSyncLabel: string;
}

export function Settings({
  open, onClose, theme, onToggleTheme,
  onExport, onImport, onClear, transactionCount,
  user, onSignIn, onSignOut, onSync, isSyncing, lastSyncLabel,
}: SettingsProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';
  const [email, setEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const hasSupabase = isSupabaseConfigured();

  const handleSignIn = async () => {
    if (!email) return;
    setAuthLoading(true);
    setAuthMessage('');
    try {
      await onSignIn(email);
      setAuthMessage('Lien envoyé ! Vérifie tes emails.');
    } catch {
      setAuthMessage('Erreur lors de l\'envoi.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <div className={cn(
        'fixed top-0 right-0 z-50 h-full w-full max-w-sm',
        'bg-zinc-950 border-l border-zinc-800',
        'transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">Paramètres</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-4rem)] p-5 space-y-6">
          {/* Compte */}
          <section>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Compte</h3>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              {!hasSupabase ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                    <User className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-300">Mode hors-ligne</p>
                    <p className="text-xs text-zinc-600">Supabase non configuré</p>
                  </div>
                </div>
              ) : user ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-indigo-400">
                        {user.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{user.email}</p>
                      <p className="text-xs text-emerald-400">Connecté</p>
                    </div>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="w-full mt-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Se déconnecter
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                      <User className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-300">Mode hors-ligne</p>
                      <p className="text-xs text-zinc-600">Données locales uniquement</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                        placeholder="Email"
                        className="w-full pl-8 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleSignIn}
                      disabled={authLoading || !email}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        email ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-zinc-800 text-zinc-600'
                      )}
                    >
                      {authLoading ? '...' : 'Go'}
                    </button>
                  </div>
                  {authMessage && (
                    <p className="text-xs text-indigo-400 mt-2">{authMessage}</p>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Apparence */}
          <section>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Apparence</h3>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <button
                onClick={onToggleTheme}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-5 h-5">
                    <Sun className={cn(
                      'w-5 h-5 absolute inset-0 text-amber-400 transition-all duration-300',
                      isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
                    )} />
                    <Moon className={cn(
                      'w-5 h-5 absolute inset-0 text-indigo-400 transition-all duration-300',
                      isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
                    )} />
                  </div>
                  <span className="text-sm text-zinc-300">{isDark ? 'Sombre' : 'Clair'}</span>
                </div>
                <div className={cn(
                  'relative w-11 h-6 rounded-full transition-colors duration-300',
                  isDark ? 'bg-indigo-500' : 'bg-zinc-600'
                )}>
                  <div className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]',
                    isDark ? 'left-6' : 'left-1'
                  )} />
                </div>
              </button>
            </div>
          </section>

          {/* Sync */}
          <section>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Stockage</h3>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-zinc-500" />
                  <div>
                    <p className="text-sm text-zinc-300">
                      {user ? 'Cloud + local' : 'Local'}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {transactionCount} transactions
                      {lastSyncLabel && ` · ${lastSyncLabel}`}
                    </p>
                  </div>
                </div>
                {user ? (
                  <button
                    onClick={onSync}
                    disabled={isSyncing}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 transition-colors"
                    title="Synchroniser"
                  >
                    <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
                  </button>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>
            </div>
          </section>

          {/* Données */}
          <section>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Données</h3>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <button
                onClick={onExport}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              >
                <Download className="w-4 h-4 text-zinc-500" />
                Exporter (JSON)
              </button>
              <div className="mx-3 border-t border-zinc-800/40" />
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={onImport} />
              <button
                onClick={() => importRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              >
                <Upload className="w-4 h-4 text-zinc-500" />
                Importer un backup
              </button>
              <div className="mx-3 border-t border-zinc-800/40" />
              <button
                onClick={onClear}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400/70 hover:text-red-400 hover:bg-zinc-800/50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Réinitialiser les données
              </button>
            </div>
          </section>

          {/* About */}
          <section>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">À propos</h3>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Version</span>
                <span className="text-zinc-400 font-mono text-xs">1.0.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Données</span>
                <span className="text-zinc-400 text-xs">Yahoo Finance</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Sync</span>
                <span className="text-zinc-400 text-xs">{hasSupabase ? 'Supabase' : 'Désactivé'}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
