import { useEffect, useRef, useState } from 'react';
import { createChart, AreaSeries, createSeriesMarkers, type IChartApi, type SeriesMarker, type Time } from 'lightweight-charts';
import type { MarketDataPoint, Transaction } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PriceChartProps {
  marketData: MarketDataPoint[];
  transactions: Transaction[];
  title: string;
}

export function PriceChart({ marketData, transactions, title }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hoverData, setHoverData] = useState<{ price: number; date: string } | null>(null);

  useEffect(() => {
    if (!containerRef.current || marketData.length === 0) return;

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

    const chartData = marketData.map(d => ({
      time: d.time as Time,
      value: d.close,
    }));
    series.setData(chartData);

    // Build markers array
    const markers: SeriesMarker<Time>[] = [];
    const marketDates = new Set(marketData.map(d => d.time));

    for (const t of transactions) {
      let markerTime: string;
      if (marketDates.has(t.date)) {
        markerTime = t.date;
      } else {
        // Find nearest market data date
        const nearest = marketData.reduce((best, d) => {
          const diff = Math.abs(new Date(d.time).getTime() - new Date(t.date).getTime());
          const bestDiff = Math.abs(new Date(best.time).getTime() - new Date(t.date).getTime());
          return diff < bestDiff ? d : best;
        }, marketData[0]);
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

    // v5 API: createSeriesMarkers instead of series.setMarkers
    createSeriesMarkers(series, markers);

    // Crosshair move handler
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
  }, [marketData, transactions]);

  const lastPrice = marketData.length > 0 ? marketData[marketData.length - 1] : null;
  const firstPrice = marketData.length > 0 ? marketData[0] : null;
  const priceChange = lastPrice && firstPrice
    ? ((lastPrice.close - firstPrice.close) / firstPrice.close) * 100
    : null;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
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

      {marketData.length === 0 ? (
        <div className="h-[350px] flex items-center justify-center text-zinc-600">
          <div className="text-center">
            <p className="text-sm">Chargement des données de marché...</p>
            <p className="text-xs mt-1">Cours via Yahoo Finance</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="h-[350px] w-full" />
      )}
    </div>
  );
}
