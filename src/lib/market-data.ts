import type { MarketDataPoint } from './types';
import { ISIN_TO_TICKER } from './types';

interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }>;
    error: unknown;
  };
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchHistoricalData(
  isin: string,
  range = '2y',
  interval = '1d'
): Promise<MarketDataPoint[]> {
  const ticker = ISIN_TO_TICKER[isin];
  if (!ticker) return [];

  try {
    const url = `/api/yahoo/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`);

    const data: YahooChartResponse = await res.json();
    const result = data.chart.result?.[0];
    if (!result) return [];

    const { timestamp, indicators } = result;
    const quote = indicators.quote[0];

    const points: MarketDataPoint[] = [];
    for (let i = 0; i < timestamp.length; i++) {
      const close = quote.close[i];
      if (close === null || close === undefined) continue;

      points.push({
        time: formatTimestamp(timestamp[i]),
        open: quote.open[i] ?? close,
        high: quote.high[i] ?? close,
        low: quote.low[i] ?? close,
        close,
        volume: quote.volume[i] ?? 0,
      });
    }

    return points;
  } catch (err) {
    console.error(`Failed to fetch market data for ${isin}:`, err);
    return [];
  }
}

export async function fetchCurrentPrice(isin: string): Promise<number | null> {
  const ticker = ISIN_TO_TICKER[isin];
  if (!ticker) return null;

  try {
    const url = `/api/yahoo/v8/finance/chart/${ticker}?range=1d&interval=1d`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data: YahooChartResponse = await res.json();
    const result = data.chart.result?.[0];
    if (!result) return null;

    const closes = result.indicators.quote[0].close;
    // Return the last non-null close
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] !== null) return closes[i];
    }
    return null;
  } catch {
    return null;
  }
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  isin?: string;
}

export async function searchSecurities(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];
  try {
    const url = `/api/yahoo/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&enableFuzzyQuery=true`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const quotes = data.quotes ?? [];
    return quotes
      .filter((q: any) => q.symbol && q.shortname)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchDisp || q.exchange || '',
        type: q.quoteType || '',
      }));
  } catch {
    return [];
  }
}

export async function fetchAllPrices(
  isins: string[]
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  const results = await Promise.all(isins.map(async (isin) => {
    const price = await fetchCurrentPrice(isin);
    return { isin, price };
  }));
  for (const { isin, price } of results) {
    if (price !== null) prices[isin] = price;
  }
  return prices;
}
