import type { Transaction, MarketDataPoint } from './types';

const STORAGE_KEY = 'pea-tracker-transactions';
const MARKET_DATA_KEY = 'pea-tracker-market-data';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

export function loadTransactions(): Transaction[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as Transaction[];
  } catch {
    return [];
  }
}

export function mergeTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  const refs = new Set(existing.map(t => t.reference).filter(Boolean));
  const dateKeys = new Set(existing.map(t => `${t.date}_${t.time}_${t.isin}_${t.quantity}`));

  const newTxns = incoming.filter(t => {
    if (t.reference && refs.has(t.reference)) return false;
    const key = `${t.date}_${t.time}_${t.isin}_${t.quantity}`;
    if (dateKeys.has(key)) return false;
    return true;
  });

  const merged = [...existing, ...newTxns];
  merged.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.time.localeCompare(b.time);
  });

  return merged;
}

interface CachedMarketData {
  timestamp: number;
  data: Record<string, MarketDataPoint[]>;
  prices: Record<string, number>;
}

export function saveMarketData(
  data: Record<string, MarketDataPoint[]>,
  prices: Record<string, number>
): void {
  const cached: CachedMarketData = {
    timestamp: Date.now(),
    data,
    prices,
  };
  localStorage.setItem(MARKET_DATA_KEY, JSON.stringify(cached));
}

export function loadMarketData(): {
  data: Record<string, MarketDataPoint[]>;
  prices: Record<string, number>;
  isStale: boolean;
} | null {
  const stored = localStorage.getItem(MARKET_DATA_KEY);
  if (!stored) return null;
  try {
    const cached = JSON.parse(stored) as CachedMarketData;
    const isStale = Date.now() - cached.timestamp > CACHE_TTL;
    return { data: cached.data, prices: cached.prices, isStale };
  } catch {
    return null;
  }
}

export function updateTransaction(transactions: Transaction[], updated: Transaction): Transaction[] {
  const idx = transactions.findIndex(t => t.id === updated.id);
  if (idx === -1) return transactions;
  const next = [...transactions];
  next[idx] = updated;
  next.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  saveTransactions(next);
  return next;
}

export function deleteTransaction(transactions: Transaction[], id: string): Transaction[] {
  const next = transactions.filter(t => t.id !== id);
  saveTransactions(next);
  return next;
}

export function exportData(transactions: Transaction[]): void {
  const payload = {
    version: 1,
    exportDate: new Date().toISOString(),
    transactions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pea-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(file: File): Promise<Transaction[]> {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (payload.version && Array.isArray(payload.transactions)) {
    return payload.transactions as Transaction[];
  }
  if (Array.isArray(payload)) {
    return payload as Transaction[];
  }
  throw new Error('Format de fichier invalide');
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(MARKET_DATA_KEY);
}
