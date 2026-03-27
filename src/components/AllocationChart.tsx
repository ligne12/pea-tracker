import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Position } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface AllocationChartProps {
  positions: Position[];
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8',
  '#f59e0b', '#fb923c', '#f87171', '#fb7185',
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-zinc-200 font-medium mb-1">{data.name}</p>
      <p className="text-zinc-400 font-tabular">{formatCurrency(data.value)}</p>
      <p className="text-zinc-500 font-tabular">{data.shares} parts &middot; PRU {formatCurrency(data.pru)}</p>
    </div>
  );
}

export function AllocationChart({ positions }: AllocationChartProps) {
  const activePositions = positions.filter(p => p.totalShares > 0);

  if (activePositions.length === 0) return null;

  const total = activePositions.reduce((sum, p) => sum + (p.currentValue ?? p.totalInvested), 0);

  const data = activePositions.map((p, i) => ({
    name: p.name,
    isin: p.isin,
    value: p.currentValue ?? p.totalInvested,
    shares: p.totalShares,
    pru: p.averageCost,
    percent: total > 0 ? ((p.currentValue ?? p.totalInvested) / total) * 100 : 0,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Répartition du portefeuille</h3>

      {/* Desktop */}
      <div className="hidden sm:flex flex-row items-center gap-6">
        <div className="w-[200px] h-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={data.length > 1 ? 3 : 0}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.isin} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 w-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800/50">
                <th className="pb-2 text-left text-xs font-medium text-zinc-500">Valeur</th>
                <th className="pb-2 text-center text-xs font-medium text-zinc-500">Parts</th>
                <th className="pb-2 text-center text-xs font-medium text-zinc-500">PRU</th>
                <th className="pb-2 text-center text-xs font-medium text-zinc-500">Valeur</th>
                <th className="pb-2 text-center text-xs font-medium text-zinc-500">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {data.map(entry => (
                <tr key={entry.isin} className="group transition-colors hover:bg-indigo-500/[0.03]">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <div>
                        <div className="text-zinc-200 text-xs truncate max-w-[180px]">{entry.name}</div>
                        <div className="text-[10px] text-zinc-600 font-mono">{entry.isin}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-center font-tabular text-zinc-300 group-hover:text-zinc-100 transition-colors">{entry.shares}</td>
                  <td className="py-2.5 text-center font-tabular text-zinc-400 group-hover:text-zinc-300 transition-colors">{formatCurrency(entry.pru)}</td>
                  <td className="py-2.5 text-center font-tabular text-zinc-200 group-hover:text-zinc-100 transition-colors">{formatCurrency(entry.value)}</td>
                  <td className="py-2.5 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 font-tabular">
                      {entry.percent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-800/50">
                <td className="py-3 text-xs text-zinc-500 font-medium">Total</td>
                <td className="py-3" />
                <td className="py-3" />
                <td className="py-3 text-center font-tabular font-semibold text-zinc-200">{formatCurrency(total)}</td>
                <td className="py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden">
        <div className="w-[180px] h-[180px] mx-auto mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={80}
                paddingAngle={data.length > 1 ? 3 : 0}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.isin} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2.5">
          {data.map(entry => (
            <div key={entry.isin} className="flex items-center gap-3 px-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 truncate">{entry.name}</p>
                <p className="text-[10px] text-zinc-600 font-mono">{entry.isin}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-tabular text-zinc-200">{formatCurrency(entry.value)}</p>
                <div className="flex items-center justify-end gap-2 text-xs text-zinc-500 font-tabular">
                  <span>{entry.shares} parts</span>
                  <span className="text-indigo-400">{entry.percent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-zinc-800/50 px-1">
            <span className="text-xs text-zinc-500 font-medium">Total</span>
            <span className="text-sm font-semibold text-zinc-200 font-tabular">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
