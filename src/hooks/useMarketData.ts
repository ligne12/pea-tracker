import { useState, useEffect, useCallback, useRef } from 'react';
import type { Transaction, MarketDataPoint } from '@/lib/types';
import { fetchHistoricalData, fetchAllPrices } from '@/lib/market-data';
import { saveMarketData, loadMarketData } from '@/lib/storage';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

type MarketStatus = 'open' | 'closed' | 'loading' | 'error';

function isMarketOpen(): boolean {
  // Get current time in Europe/Paris (handles DST correctly)
  const parisNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' })
  );
  const day = parisNow.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  // Euronext Paris: 9:00 - 17:30
  const hours = parisNow.getHours() + parisNow.getMinutes() / 60;
  return hours >= 9 && hours <= 17.5;
}

export function useMarketData(transactions: Transaction[]) {
  const [marketDataMap, setMarketDataMap] = useState<Record<string, MarketDataPoint[]>>({});
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatus>('loading');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load cache on mount
  useEffect(() => {
    const cached = loadMarketData();
    if (cached) {
      setMarketDataMap(cached.data);
      setMarketPrices(cached.prices);
      setLastRefresh(Date.now());
      setMarketStatus(isMarketOpen() ? 'open' : 'closed');
    }
  }, []);

  const refresh = useCallback(async (txns: Transaction[]) => {
    const isins = [...new Set(txns.map(t => t.isin))];
    if (isins.length === 0) return;

    setMarketStatus('loading');
    try {
      const [prices, ...historicals] = await Promise.all([
        fetchAllPrices(isins),
        ...isins.map(isin => fetchHistoricalData(isin)),
      ]);

      const dataMap: Record<string, MarketDataPoint[]> = {};
      isins.forEach((isin, i) => {
        dataMap[isin] = historicals[i];
      });

      setMarketPrices(prices);
      setMarketDataMap(dataMap);
      setLastRefresh(Date.now());
      setMarketStatus(isMarketOpen() ? 'open' : 'closed');
      saveMarketData(dataMap, prices);
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      setMarketStatus('error');
    }
  }, []);

  // Fetch when transactions change (new ISINs or stale cache)
  useEffect(() => {
    if (transactions.length === 0) return;
    const isins = [...new Set(transactions.map(t => t.isin))];
    const cached = loadMarketData();

    // Fetch if no cache, stale, or missing ISINs
    if (!cached || cached.isStale) {
      refresh(transactions);
      return;
    }
    const cachedIsins = new Set(Object.keys(cached.prices));
    const missing = isins.some(isin => !cachedIsins.has(isin));
    if (missing) {
      refresh(transactions);
    }
  }, [transactions, refresh]);

  // Auto-refresh during market hours
  useEffect(() => {
    if (transactions.length === 0) return;

    const tick = () => {
      if (isMarketOpen()) {
        refresh(transactions);
      } else {
        setMarketStatus('closed');
      }
    };

    intervalRef.current = setInterval(tick, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [transactions, refresh]);

  // Live "time ago" — re-renders every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const getLastRefreshLabel = useCallback((): string => {
    if (!lastRefresh) return '';
    const diffMs = Date.now() - lastRefresh;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return `maj ${new Date(lastRefresh).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    return `il y a ${diffH}h${diffMin % 60 > 0 ? String(diffMin % 60).padStart(2, '0') : ''}`;
  }, [lastRefresh]);

  return {
    marketDataMap,
    marketPrices,
    marketStatus,
    lastRefresh,
    getLastRefreshLabel,
    refresh,
    isMarketOpen: isMarketOpen(),
  };
}
