import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { ISIN_TO_NAME, ISIN_TO_TICKER } from '@/lib/types';
import { searchSecurities, type SearchResult } from '@/lib/market-data';
import { generateId, cn } from '@/lib/utils';

interface TransactionFormProps {
  transaction?: Transaction | null;
  onSave: (transaction: Transaction) => void;
  onClose: () => void;
}

interface Suggestion {
  isin: string;
  name: string;
  ticker: string;
  exchange: string;
  source: 'local' | 'yahoo';
}

const LOCAL_ENTRIES: Suggestion[] = Object.entries(ISIN_TO_NAME).map(([isin, name]) => ({
  isin,
  name,
  ticker: ISIN_TO_TICKER[isin] ?? '',
  exchange: 'Euronext Paris',
  source: 'local',
}));

export function TransactionForm({ transaction, onSave, onClose }: TransactionFormProps) {
  const isEdit = !!transaction;

  const [type, setType] = useState<'ACHAT' | 'VENTE'>(transaction?.type ?? 'ACHAT');
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(transaction?.time ?? '09:00:00');
  const [isin, setIsin] = useState(transaction?.isin ?? '');
  const [name, setName] = useState(transaction?.name ?? '');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState(String(transaction?.quantity ?? ''));
  const [price, setPrice] = useState(String(transaction?.price ?? ''));
  const [commission, setCommission] = useState(String(transaction?.commission ?? ''));
  const [fees, setFees] = useState(String(transaction?.fees ?? '0'));

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const qty = Number(quantity) || 0;
  const prc = Number(price) || 0;
  const comm = Number(commission) || 0;
  const ttf = Number(fees) || 0;
  const grossAmount = Math.round(qty * prc * 100) / 100;
  const netAmount = type === 'ACHAT'
    ? Math.round((grossAmount + comm + ttf) * 100) / 100
    : Math.round((grossAmount - comm - ttf) * 100) / 100;

  // Debounced search
  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions(LOCAL_ENTRIES.slice(0, 5));
      setIsSearching(false);
      return;
    }

    const q = query.toLowerCase();

    // Local results first
    const localResults = LOCAL_ENTRIES.filter(
      e => e.isin.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || e.ticker.toLowerCase().includes(q)
    ).slice(0, 3);

    setSuggestions(localResults);
    setIsSearching(true);

    // Yahoo Finance search
    const yahooResults = await searchSecurities(query);
    const yahooSuggestions: Suggestion[] = yahooResults.map((r: SearchResult) => ({
      isin: '',
      name: r.name,
      ticker: r.symbol,
      exchange: r.exchange,
      source: 'yahoo' as const,
    }));

    // Merge: local first, then yahoo (deduplicate by ticker)
    const localTickers = new Set(localResults.map(e => e.ticker));
    const uniqueYahoo = yahooSuggestions.filter(e => !localTickers.has(e.ticker));

    setSuggestions([...localResults, ...uniqueYahoo].slice(0, 8));
    setIsSearching(false);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const selectSuggestion = (entry: Suggestion) => {
    setIsin(entry.isin || entry.ticker);
    setName(entry.name);
    setTicker(entry.ticker);
    setSearchQuery(entry.name);
    setShowSuggestions(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-commission estimation (0.5% for Bourso PEA)
  useEffect(() => {
    if (!isEdit && grossAmount > 0 && commission === '') {
      setCommission(String(Math.round(grossAmount * 0.005 * 100) / 100));
    }
  }, [grossAmount, isEdit, commission]);

  const isValid = (isin.length >= 2 || ticker.length >= 2) && qty > 0 && prc > 0 && date;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const txn: Transaction = {
      id: transaction?.id ?? generateId(),
      date,
      time,
      type,
      name: name || isin || ticker,
      isin: isin.length >= 12 ? isin : ticker,
      quantity: qty,
      price: prc,
      grossAmount,
      commission: comm,
      fees: ttf,
      netAmount,
      market: transaction?.market ?? 'EURONEXT PARIS',
      reference: transaction?.reference ?? '',
    };

    onSave(txn);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">
            {isEdit ? 'Modifier la transaction' : 'Nouvelle transaction'}
          </h2>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type */}
          <div className="flex gap-2">
            {(['ACHAT', 'VENTE'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-all border',
                  type === t
                    ? t === 'ACHAT'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-red-500/15 border-red-500/40 text-red-400'
                    : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Heure</label>
              <input
                type="time"
                step="1"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Security search */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs text-zinc-500 mb-1">Valeur</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => { setShowSuggestions(true); if (!searchQuery) doSearch(''); }}
                placeholder="Rechercher par nom, ISIN ou ticker..."
                className="w-full pl-9 pr-9 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden max-h-[280px] overflow-y-auto">
                {suggestions.map((entry, i) => (
                  <button
                    key={`${entry.ticker}-${entry.isin}-${i}`}
                    type="button"
                    onClick={() => selectSuggestion(entry)}
                    className="w-full px-3 py-2.5 text-left hover:bg-zinc-700/80 transition-colors border-b border-zinc-700/30 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-200 truncate">{entry.name}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded ml-2 shrink-0',
                        entry.source === 'local'
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'bg-zinc-700 text-zinc-400'
                      )}>
                        {entry.source === 'local' ? 'Enregistré' : 'Yahoo'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {entry.ticker}
                      {entry.isin && ` · ${entry.isin}`}
                      {entry.exchange && ` · ${entry.exchange}`}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected value display */}
            {name && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-indigo-400">{name}</span>
                {isin && <span className="text-[10px] text-zinc-600 font-mono">{isin}</span>}
                {ticker && <span className="text-[10px] text-zinc-600 font-mono">{ticker}</span>}
              </div>
            )}
          </div>

          {/* Quantity + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Quantité</label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="10"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Cours (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="81.18"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Commission + TTF */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Commission (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={commission}
                onChange={e => setCommission(e.target.value)}
                placeholder="4.46"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Frais TTF (EUR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={fees}
                onChange={e => setFees(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Computed amounts */}
          <div className="bg-zinc-800/50 rounded-lg p-3 flex justify-between text-sm border border-zinc-700/50">
            <div>
              <span className="text-zinc-500">Brut: </span>
              <span className="text-zinc-300 font-tabular">{grossAmount.toFixed(2)} EUR</span>
            </div>
            <div>
              <span className="text-zinc-500">Net: </span>
              <span className={cn('font-semibold font-tabular', type === 'ACHAT' ? 'text-red-300' : 'text-emerald-300')}>
                {type === 'ACHAT' ? '-' : '+'}{netAmount.toFixed(2)} EUR
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                isValid
                  ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              )}
            >
              {isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
