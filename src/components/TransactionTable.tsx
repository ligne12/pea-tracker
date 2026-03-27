import { useState } from 'react';
import { ArrowUpDown, ArrowDown, ArrowUp, Pencil, Trash2, SlidersHorizontal } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { formatCurrency, formatDate, formatNumber, cn } from '@/lib/utils';

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
}

type SortField = 'date' | 'type' | 'quantity' | 'price' | 'netAmount' | 'commission';
type SortDir = 'asc' | 'desc';
type FilterType = 'all' | 'ACHAT' | 'VENTE';

export function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = filterType === 'all'
    ? transactions
    : transactions.filter(t => t.type === filterType);

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'date':
        cmp = a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
        break;
      case 'type':
        cmp = a.type.localeCompare(b.type);
        break;
      case 'quantity':
        cmp = a.quantity - b.quantity;
        break;
      case 'price':
        cmp = a.price - b.price;
        break;
      case 'netAmount':
        cmp = a.netAmount - b.netAmount;
        break;
      case 'commission':
        cmp = (a.commission + a.fees) - (b.commission + b.fees);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-indigo-400" />
      : <ArrowDown className="w-3 h-3 text-indigo-400" />;
  }

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      onDelete?.(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const achatCount = transactions.filter(t => t.type === 'ACHAT').length;
  const venteCount = transactions.filter(t => t.type === 'VENTE').length;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">
          Historique des transactions
          <span className="ml-2 text-xs text-zinc-600">
            ({filtered.length}{filtered.length !== transactions.length ? `/${transactions.length}` : ''} ordres)
          </span>
        </h3>

        {/* Desktop filter pills */}
        <div className="hidden sm:flex items-center gap-1">
          {([
            { value: 'all', label: 'Tout', count: transactions.length },
            { value: 'ACHAT', label: 'Achats', count: achatCount },
            { value: 'VENTE', label: 'Ventes', count: venteCount },
          ] as const).map(f => (
            <button
              key={f.value}
              onClick={() => setFilterType(f.value)}
              disabled={f.value !== 'all' && f.count === 0}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                filterType === f.value
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-400',
                f.value !== 'all' && f.count === 0 && 'opacity-30 cursor-not-allowed'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className={cn(
            'sm:hidden p-1.5 rounded-lg transition-colors',
            showMobileFilters ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile filters bar */}
      {showMobileFilters && (
        <div className="sm:hidden px-4 py-3 border-b border-zinc-800/60 flex flex-col gap-3">
          {/* Type filter */}
          <div className="flex gap-1.5">
            {([
              { value: 'all', label: 'Tout' },
              { value: 'ACHAT', label: 'Achats' },
              { value: 'VENTE', label: 'Ventes' },
            ] as const).map(f => (
              <button
                key={f.value}
                onClick={() => setFilterType(f.value)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  filterType === f.value
                    ? f.value === 'ACHAT'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : f.value === 'VENTE'
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                    : 'border-zinc-800 text-zinc-600'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-600">Trier par</span>
            <div className="flex gap-1 flex-1">
              {([
                { value: 'date', label: 'Date' },
                { value: 'netAmount', label: 'Montant' },
                { value: 'price', label: 'Cours' },
              ] as const).map(s => (
                <button
                  key={s.value}
                  onClick={() => {
                    if (sortField === s.value) {
                      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField(s.value);
                      setSortDir('desc');
                    }
                  }}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1',
                    sortField === s.value
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'text-zinc-600'
                  )}
                >
                  {s.label}
                  {sortField === s.value && (
                    sortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/50">
              {[
                { field: 'date' as const, label: 'Date' },
                { field: 'type' as const, label: 'Type' },
                { field: null, label: 'Valeur' },
                { field: 'quantity' as const, label: 'Qté' },
                { field: 'price' as const, label: 'Cours' },
                { field: null, label: 'Brut' },
                { field: 'commission' as const, label: 'Frais' },
                { field: 'netAmount' as const, label: 'Net' },
              ].map(({ field, label }) => (
                <th
                  key={label}
                  className={cn(
                    'px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider',
                    field && 'cursor-pointer hover:text-zinc-300 transition-colors select-none'
                  )}
                  onClick={() => field && toggleSort(field)}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {label}
                    {field && <SortIcon field={field} />}
                  </div>
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-4 py-3 w-20" />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/30">
            {sorted.map((txn) => (
              <tr
                key={txn.id}
                className="group transition-colors hover:bg-indigo-500/[0.03]"
              >
                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                  <div className="font-tabular text-zinc-200">{formatDate(txn.date)}</div>
                  <div className="text-xs text-zinc-600 font-tabular">{txn.time}</div>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    txn.type === 'ACHAT'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  )}>
                    {txn.type}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <div className="text-zinc-200 text-xs max-w-[200px] truncate mx-auto group-hover:text-zinc-100 transition-colors">{txn.name}</div>
                  <div className="text-xs text-zinc-600 font-mono">{txn.isin}</div>
                </td>
                <td className="px-4 py-3.5 font-tabular text-zinc-300 text-center group-hover:text-zinc-100 transition-colors">
                  {txn.quantity}
                </td>
                <td className="px-4 py-3.5 font-tabular text-zinc-300 text-center group-hover:text-zinc-100 transition-colors">
                  {formatNumber(txn.price)} €
                </td>
                <td className="px-4 py-3.5 font-tabular text-zinc-500 text-center">
                  {formatCurrency(txn.grossAmount)}
                </td>
                <td className="px-4 py-3.5 font-tabular text-amber-400/80 text-center">
                  {formatCurrency(txn.commission + txn.fees)}
                </td>
                <td className="px-4 py-3.5 font-tabular font-medium text-center">
                  <span className={cn(
                    'transition-colors',
                    txn.type === 'ACHAT' ? 'text-red-400/80 group-hover:text-red-300' : 'text-emerald-400/80 group-hover:text-emerald-300'
                  )}>
                    {txn.type === 'ACHAT' ? '-' : '+'}{formatCurrency(txn.netAmount)}
                  </span>
                </td>
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(txn)}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => handleDelete(txn.id)}
                          className={cn(
                            'p-1.5 rounded-md transition-all',
                            deleteConfirm === txn.id
                              ? 'text-red-400 bg-red-500/10'
                              : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10'
                          )}
                          title={deleteConfirm === txn.id ? 'Cliquer pour confirmer' : 'Supprimer'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-zinc-800/30">
        {sorted.map((txn) => (
          <div key={txn.id} className="px-4 py-3.5 active:bg-zinc-800/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold',
                  txn.type === 'ACHAT'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                )}>
                  {txn.type}
                </span>
                <span className="text-xs text-zinc-500 font-tabular">{formatDate(txn.date)}</span>
              </div>
              <div className="flex items-center gap-1">
                {onEdit && (
                  <button
                    onClick={() => onEdit(txn)}
                    className="p-1.5 rounded-md text-zinc-600 hover:text-indigo-400 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => handleDelete(txn.id)}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      deleteConfirm === txn.id
                        ? 'text-red-400'
                        : 'text-zinc-600 hover:text-red-400'
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm text-zinc-200 truncate max-w-[200px]">{txn.name}</p>
                <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{txn.isin}</p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className={cn(
                  'text-base font-semibold font-tabular',
                  txn.type === 'ACHAT' ? 'text-red-300' : 'text-emerald-300'
                )}>
                  {txn.type === 'ACHAT' ? '-' : '+'}{formatCurrency(txn.netAmount)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500 font-tabular">
              <span>{txn.quantity} × {formatNumber(txn.price)} €</span>
              <span className="text-zinc-700">·</span>
              <span className="text-amber-400/70">Frais {formatCurrency(txn.commission + txn.fees)}</span>
            </div>
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-zinc-600">
            Aucune transaction {filterType !== 'all' ? `de type ${filterType}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
