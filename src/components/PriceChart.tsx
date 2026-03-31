import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, AreaSeries, createSeriesMarkers, type IChartApi, type SeriesMarker, type Time } from 'lightweight-charts';
import { Search, ChevronDown, X } from 'lucide-react';
import type { MarketDataPoint, Transaction, Position } from '@/lib/types';
import { ISIN_TO_TICKER } from '@/lib/types';
import { fetchHistoricalData, searchSecurities, type SearchResult } from '@/lib/market-data';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const TIMEFRAMES = [
  { label: '1M', range: '1mo' },
  { label: '3M', range: '3mo' },
  { label: '6M', range: '6mo' },
  { label: '1A', range: '1y' },
  { label: '2A', range: '2y' },
  { label: '5A', range: '5y' },
] as const;

type TimeframeRange = typeof TIMEFRAMES[number]['range'];

interface PriceChartProps {
  positions: Position[];
  transactions: Transaction[];
  /** Pre-loaded 2y market data per ISIN (from useMarketData) */
  marketDataMap: Record<string, MarketDataPoint[]>;
}

export function PriceChart({ positions, transactions, marketDataMap }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hoverData, setHoverData] = useState<{ price: number; date: string } | null>(null);

  // Asset selection
  const [selectedIsin, setSelectedIsin] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Timeframe
  const [timeframe, setTimeframe] = useState<TimeframeRange>('2y');

  // Chart data (may differ from marketDataMap when timeframe != 2y or searching external asset)
  const [chartData, setChartData] = useState<MarketDataPoint[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  // Default to first position
  useEffect(() => {
    if (!selectedIsin && positions.length > 0) {
      setSelectedIsin(positions[0].isin);
    }
  }, [positions, selectedIsin]);

  // Fetch chart data when isin or timeframe changes
  useEffect(() => {
    if (!selectedIsin) return;

    // For 2y timeframe, use pre-loaded data if available
    if (timeframe === '2y' && marketDataMap[selectedIsin]?.length) {
      setChartData(marketDataMap[selectedIsin]);
      return;
    }

    // Otherwise fetch
    let cancelled = false;
    setIsLoadingChart(true);

    // Determine interval based on range
    const interval = timeframe === '1mo' || timeframe === '3mo' ? '1d' : '1d';

    fetchHistoricalData(selectedIsin, timeframe, interval).then(data => {
      if (!cancelled) {
        setChartData(data);
        setIsLoadingChart(false);
      }
    }).catch(() => {
      if (!cancelled) setIsLoadingChart(false);
    });

    return () => { cancelled = true; };
  }, [selectedIsin, timeframe, marketDataMap]);

  // Search Yahoo Finance
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchSecurities(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Select an asset from search results (external ticker)
  const handleSelectSearchResult = useCallback((result: SearchResult) => {
    // Add ticker mapping temporarily so fetchHistoricalData can resolve it
    // We use the symbol directly as a "pseudo-ISIN"
    const pseudoIsin = result.symbol;
    if (!ISIN_TO_TICKER[pseudoIsin]) {
      ISIN_TO_TICKER[pseudoIsin] = result.symbol;
    }
    setSelectedIsin(pseudoIsin);
    setShowDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Get selected position/name
  const selectedPosition = positions.find(p => p.isin === selectedIsin);
  const selectedName = selectedPosition?.name ?? selectedIsin;

  // Filter transactions for selected asset
  const filteredTransactions = transactions.filter(t => t.isin === selectedIsin);

  // ─── Chart rendering ───
  useEffect(() => {
    if (!containerRef.current || chartData.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#a1a1aa',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(63, 63, 70, 0.3)' },
        horzLines: { color: 'rgba(63, 63, 70, 0.3)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(99, 102, 241, 0.4)', width: 1, style: 2 },
        horzLine: { color: 'rgba(99, 102, 241, 0.4)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: 'rgba(63, 63, 70, 0.5)',
      },
      timeScale: {
        borderColor: 'rgba(63, 63, 70, 0.5)',
        timeVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#6366f1',
      lineWidth: 2,
      topColor: 'rgba(99, 102, 241, 0.3)',
      bottomColor: 'rgba(99, 102, 241, 0.02)',
      crosshairMarkerBackgroundColor: '#6366f1',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    const seriesData = chartData.map(d => ({
      time: d.time as Time,
      value: d.close,
    }));
    series.setData(seriesData);

    // Build markers array
    const markers: SeriesMarker<Time>[] = [];
    const marketDates = new Set(chartData.map(d => d.time));

    for (const t of filteredTransactions) {
      let markerTime: string;
      if (marketDates.has(t.date)) {
        markerTime = t.date;
      } else {
        const nearest = chartData.reduce((best, d) => {
          const diff = Math.abs(new Date(d.time).getTime() - new Date(t.date).getTime());
          const bestDiff = Math.abs(new Date(best.time).getTime() - new Date(t.date).getTime());
          return diff < bestDiff ? d : best;
        }, chartData[0]);
        markerTime = nearest.time;
      }

      markers.push({
        time: markerTime as Time,
        position: t.type === 'ACHAT' ? 'belowBar' : 'aboveBar',
        color: t.type === 'ACHAT' ? '#34d399' : '#f87171',
        shape: t.type === 'ACHAT' ? 'arrowUp' : 'arrowDown',
        text: `${t.type === 'ACHAT' ? 'A' : 'V'} ${t.quantity}\u00D7${t.price.toFixed(2)}\u20AC`,
      });
    }

    markers.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    createSeriesMarkers(series, markers);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        setHoverData(null);
        return;
      }
      const data = param.seriesData.get(series);
      if (data && 'value' in data) {
        setHoverData({
          price: data.value as number,
          date: String(param.time),
        });
      }
    });

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData, filteredTransactions]);

  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const firstPrice = chartData.length > 0 ? chartData[0] : null;
  const priceChange = lastPrice && firstPrice
    ? ((lastPrice.close - firstPrice.close) / firstPrice.close) * 100
    : null;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
      {/* Header row: asset selector + timeframe + legend */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          {/* Asset selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-200 hover:text-zinc-50 transition-colors max-w-full"
            >
              <span className="truncate">{selectedName}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform', showDropdown && 'rotate-180')} />
            </button>

            {showDropdown && (
              <div className="absolute top-full left-0 mt-1.5 w-80 max-h-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                {/* Search input */}
                <div className="p-2 border-b border-zinc-800">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => handleSearch(e.target.value)}
                      placeholder="Rechercher un actif..."
                      className="w-full pl-8 pr-8 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-y-auto max-h-60">
                  {/* Wallet positions */}
                  {positions.length > 0 && !searchQuery && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                        Portefeuille
                      </div>
                      {positions.map(p => (
                        <button
                          key={p.isin}
                          onClick={() => {
                            setSelectedIsin(p.isin);
                            setShowDropdown(false);
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition-colors flex items-center justify-between',
                            p.isin === selectedIsin && 'bg-zinc-800/60'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="text-zinc-200 truncate">{p.name}</div>
                            <div className="text-[11px] text-zinc-500">{p.ticker} · {p.isin}</div>
                          </div>
                          {p.isin === selectedIsin && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Search results */}
                  {searchQuery && (
                    <div>
                      {/* Also show matching wallet positions */}
                      {positions.filter(p =>
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.isin.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.ticker.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map(p => (
                        <button
                          key={p.isin}
                          onClick={() => {
                            setSelectedIsin(p.isin);
                            setShowDropdown(false);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition-colors',
                            p.isin === selectedIsin && 'bg-zinc-800/60'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="text-zinc-200 truncate">{p.name}</div>
                              <div className="text-[11px] text-zinc-500">{p.ticker} · {p.isin}</div>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded shrink-0 ml-2">
                              Portefeuille
                            </span>
                          </div>
                        </button>
                      ))}

                      {isSearching && (
                        <div className="px-3 py-3 text-xs text-zinc-500 text-center">Recherche...</div>
                      )}

                      {searchResults.map(r => (
                        <button
                          key={r.symbol}
                          onClick={() => handleSelectSearchResult(r)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="text-zinc-200 truncate">{r.name}</div>
                              <div className="text-[11px] text-zinc-500">{r.symbol} · {r.exchange}</div>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded shrink-0 ml-2">
                              Yahoo
                            </span>
                          </div>
                        </button>
                      ))}

                      {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
                        <div className="px-3 py-3 text-xs text-zinc-500 text-center">Aucun résultat</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Price display */}
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-semibold text-zinc-50 font-tabular">
              {hoverData
                ? formatCurrency(hoverData.price)
                : lastPrice
                  ? formatCurrency(lastPrice.close)
                  : '—'}
            </span>
            {hoverData ? (
              <span className="text-xs text-zinc-500">{formatDate(hoverData.date)}</span>
            ) : priceChange !== null && (
              <span className={`text-sm font-medium font-tabular ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* Right side: timeframe + legend */}
        <div className="flex flex-col items-end gap-2">
          {/* Timeframe selector */}
          <div className="flex items-center gap-0.5 bg-zinc-800/50 rounded-lg p-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.range}
                onClick={() => setTimeframe(tf.range)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  timeframe === tf.range
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Achat
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Vente
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 || isLoadingChart ? (
        <div className="h-[350px] flex items-center justify-center text-zinc-600">
          <div className="text-center">
            <p className="text-sm">{isLoadingChart ? 'Chargement...' : 'Chargement des données de marché...'}</p>
            <p className="text-xs mt-1">Cours via Yahoo Finance</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="h-[350px] w-full" />
      )}
    </div>
  );
}
