import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { DCADataPoint } from '@/lib/types';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import { computeMonthlyInvestments, computePRUEvolution } from '@/lib/calculations';
import type { Transaction } from '@/lib/types';

interface DCAChartProps {
  dcaData: DCADataPoint[];
  transactions: Transaction[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-zinc-300 font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-tabular">
          {entry.name}: {typeof entry.value === 'number' && entry.value > 100
            ? formatCurrency(entry.value)
            : formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function DCAChart({ dcaData, transactions }: DCAChartProps) {
  const monthlyData = computeMonthlyInvestments(transactions);
  const pruData = computePRUEvolution(transactions).map(d => ({
    ...d,
    date: formatDate(d.date),
  }));

  const cumulativeData = dcaData.map(d => ({
    ...d,
    date: formatDate(d.date),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Cumulative Investment */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Investissement cumulé</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,0.3)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="stepAfter"
                dataKey="totalInvested"
                name="Total investi"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#investGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PRU Evolution */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">PRU vs Cours d'achat</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pruData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,0.3)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v.toFixed(0)}€`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="pru"
                name="PRU (avec frais)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f59e0b' }}
              />
              <Line
                type="monotone"
                dataKey="pruExFees"
                name="PRU (hors frais)"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="price"
                name="Cours d'achat"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Investments */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5 lg:col-span-2">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Investissement mensuel</h3>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,0.3)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v.toFixed(0)}€`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="amount"
                name="Montant investi"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
