import { TrendingUp, TrendingDown, Wallet, BarChart3, Coins, Hash, Activity, Timer } from 'lucide-react';
import type { PortfolioMetrics } from '@/lib/types';
import { formatCurrency, formatPercent, cn, gainColor } from '@/lib/utils';

interface KPICardsProps {
  metrics: PortfolioMetrics;
}

interface CardProps {
  label: string;
  value: string;
  subValue?: string;
  subColor?: string;
  icon: React.ReactNode;
  accent?: 'default' | 'positive' | 'negative';
  glowClass?: string;
}

function Card({ label, value, subValue, subColor, icon, accent = 'default', glowClass }: CardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 sm:p-5 transition-all duration-300',
      'hover:border-zinc-700/80 hover:bg-zinc-900/80',
      glowClass
    )}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider leading-tight">{label}</span>
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
          accent === 'positive' && 'bg-emerald-500/10 text-emerald-400',
          accent === 'negative' && 'bg-red-500/10 text-red-400',
          accent === 'default' && 'bg-zinc-800 text-zinc-400',
        )}>
          {icon}
        </div>
      </div>
      <div className={cn(
        'text-xl sm:text-2xl font-semibold font-tabular tracking-tight leading-none',
        accent === 'positive' && 'text-emerald-400',
        accent === 'negative' && 'text-red-400',
        accent === 'default' && 'text-zinc-50',
      )}>
        {value}
      </div>
      {subValue && (
        <div className={cn('text-xs sm:text-sm mt-1.5 font-tabular', subColor ?? 'text-zinc-500')}>
          {subValue}
        </div>
      )}
    </div>
  );
}

export function KPICards({ metrics }: KPICardsProps) {
  const gainAccent: 'default' | 'positive' | 'negative' = metrics.totalGain !== null
    ? (metrics.totalGain >= 0 ? 'positive' : 'negative')
    : 'default';

  const gainGlow = metrics.totalGain !== null
    ? (metrics.totalGain >= 0 ? 'glow-green' : 'glow-red')
    : '';

  return (
    <div className="space-y-3">
      {/* Row 1: Main financial metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          label="Investi"
          value={formatCurrency(metrics.totalInvested)}
          subValue={`${metrics.positions.reduce((s, p) => s + p.transactions.length, 0)} ordres`}
          icon={<Wallet className="w-4 h-4" />}
        />

        <Card
          label="Valeur"
          value={metrics.totalValue !== null ? formatCurrency(metrics.totalValue) : '\u2014'}
          subValue={metrics.totalValue !== null ? 'Cours live' : 'Chargement...'}
          subColor={metrics.totalValue !== null ? 'text-indigo-400' : 'text-zinc-600'}
          icon={<BarChart3 className="w-4 h-4" />}
          accent="default"
          glowClass={metrics.totalValue !== null ? 'glow-indigo' : ''}
        />

        <Card
          label="Plus-value"
          value={metrics.totalGain !== null
            ? `${metrics.totalGain >= 0 ? '+' : ''}${formatCurrency(metrics.totalGain)}`
            : '\u2014'}
          subValue={metrics.totalGainPercent !== null ? formatPercent(metrics.totalGainPercent) : undefined}
          subColor={gainColor(metrics.totalGain)}
          icon={metrics.totalGain !== null && metrics.totalGain >= 0
            ? <TrendingUp className="w-4 h-4" />
            : <TrendingDown className="w-4 h-4" />}
          accent={gainAccent}
          glowClass={gainGlow}
        />

        <Card
          label="P&L hors frais"
          value={metrics.totalGainExFees !== null
            ? `${metrics.totalGainExFees >= 0 ? '+' : ''}${formatCurrency(metrics.totalGainExFees)}`
            : '\u2014'}
          subValue={metrics.totalGainExFeesPercent !== null ? formatPercent(metrics.totalGainExFeesPercent) : undefined}
          subColor={gainColor(metrics.totalGainExFees)}
          icon={metrics.totalGainExFees !== null && metrics.totalGainExFees >= 0
            ? <TrendingUp className="w-4 h-4" />
            : <TrendingDown className="w-4 h-4" />}
          accent={metrics.totalGainExFees !== null
            ? (metrics.totalGainExFees >= 0 ? 'positive' : 'negative')
            : 'default'}
        />
      </div>

      {/* Row 2: Stats & performance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          label="Frais"
          value={formatCurrency(metrics.totalFees)}
          subValue={metrics.totalInvested > 0
            ? `${((metrics.totalFees / metrics.totalInvested) * 100).toFixed(2)}% du total`
            : undefined}
          icon={<Coins className="w-4 h-4" />}
        />

        <Card
          label="Parts"
          value={String(metrics.totalShares)}
          subValue={metrics.positions.length > 0
            ? `${metrics.positions.length} ligne${metrics.positions.length > 1 ? 's' : ''}`
            : undefined}
          icon={<Hash className="w-4 h-4" />}
        />

        <Card
          label="XIRR"
          value={metrics.xirr !== null ? formatPercent(metrics.xirr) : '\u2014'}
          subValue="Rdt. pondéré"
          icon={<Activity className="w-4 h-4" />}
          accent={metrics.xirr !== null ? (metrics.xirr >= 0 ? 'positive' : 'negative') : 'default'}
        />

        <Card
          label="TWR"
          value={metrics.twr !== null ? formatPercent(metrics.twr) : '\u2014'}
          subValue="Rdt. annualisé"
          icon={<Timer className="w-4 h-4" />}
          accent={metrics.twr !== null ? (metrics.twr >= 0 ? 'positive' : 'negative') : 'default'}
        />
      </div>
    </div>
  );
}
