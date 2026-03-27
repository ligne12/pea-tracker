import { supabase } from './supabase';
import type { Transaction } from './types';

interface DbTransaction {
  id: string;
  user_id: string;
  date: string;
  time: string;
  type: string;
  name: string;
  isin: string;
  quantity: number;
  price: number;
  gross_amount: number;
  commission: number;
  fees: number;
  net_amount: number;
  market: string;
  reference: string;
  updated_at: string;
}

function toDb(txn: Transaction, userId: string): DbTransaction {
  return {
    id: txn.id,
    user_id: userId,
    date: txn.date,
    time: txn.time,
    type: txn.type,
    name: txn.name,
    isin: txn.isin,
    quantity: txn.quantity,
    price: txn.price,
    gross_amount: txn.grossAmount,
    commission: txn.commission,
    fees: txn.fees,
    net_amount: txn.netAmount,
    market: txn.market,
    reference: txn.reference,
    updated_at: new Date().toISOString(),
  };
}

function fromDb(row: DbTransaction): Transaction {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    type: row.type as 'ACHAT' | 'VENTE',
    name: row.name,
    isin: row.isin,
    quantity: row.quantity,
    price: Number(row.price),
    grossAmount: Number(row.gross_amount),
    commission: Number(row.commission),
    fees: Number(row.fees),
    netAmount: Number(row.net_amount),
    market: row.market,
    reference: row.reference,
  };
}

export async function pullTransactions(): Promise<Transaction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Pull failed:', error);
    return [];
  }
  return (data ?? []).map(fromDb);
}

export async function pushTransactions(
  transactions: Transaction[],
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase non configuré' };

  const rows = transactions.map(t => toDb(t, userId));

  const { error } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('Push failed:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function deleteRemoteTransaction(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete failed:', error);
    return false;
  }
  return true;
}

/**
 * Full sync: pull remote, merge with local, push merged back.
 * Last-write-wins based on transaction id.
 */
export async function syncAll(
  localTransactions: Transaction[],
  userId: string
): Promise<{ merged: Transaction[]; pulled: number; pushed: number }> {
  const remote = await pullTransactions();

  // Merge: create a map by id, remote wins for existing, add local-only
  const map = new Map<string, Transaction>();
  for (const t of remote) map.set(t.id, t);

  let pushed = 0;
  for (const t of localTransactions) {
    if (!map.has(t.id)) {
      map.set(t.id, t);
      pushed++;
    }
  }

  const merged = [...map.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
  );

  // Push local-only transactions to remote
  if (pushed > 0) {
    const localOnly = localTransactions.filter(t => !remote.find(r => r.id === t.id));
    await pushTransactions(localOnly, userId);
  }

  return { merged, pulled: remote.length, pushed };
}
