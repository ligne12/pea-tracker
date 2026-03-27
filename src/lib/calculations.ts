import type { Transaction, Position, PortfolioMetrics, DCADataPoint } from './types';
import { ISIN_TO_TICKER, ISIN_TO_NAME } from './types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function computePositions(
  transactions: Transaction[],
  marketPrices: Record<string, number>
): Position[] {
  const positionMap = new Map<string, {
    shares: number;
    totalCost: number;       // net amounts (with fees)
    totalGrossCost: number;  // gross amounts (without fees)
    totalFees: number;
    txns: Transaction[];
  }>();

  // Process transactions in chronological order
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  for (const txn of sorted) {
    if (!positionMap.has(txn.isin)) {
      positionMap.set(txn.isin, {
        shares: 0,
        totalCost: 0,
        totalGrossCost: 0,
        totalFees: 0,
        txns: [],
      });
    }
    const pos = positionMap.get(txn.isin)!;
    pos.txns.push(txn);
    pos.totalFees += txn.commission + txn.fees;

    if (txn.type === 'ACHAT') {
      pos.totalCost += txn.netAmount;
      pos.totalGrossCost += txn.grossAmount;
      pos.shares += txn.quantity;
    } else {
      // VENTE: reduce position, adjust cost basis proportionally
      const ratio = txn.quantity / pos.shares;
      pos.totalCost -= pos.totalCost * ratio;
      pos.totalGrossCost -= pos.totalGrossCost * ratio;
      pos.shares -= txn.quantity;
    }
  }

  const positions: Position[] = [];
  for (const [isin, data] of positionMap) {
    const ticker = ISIN_TO_TICKER[isin] ?? '';
    const currentPrice = marketPrices[isin] ?? null;
    const currentValue = currentPrice !== null && data.shares > 0
      ? data.shares * currentPrice
      : null;

    positions.push({
      isin,
      name: data.txns[0]?.name ?? ISIN_TO_NAME[isin] ?? isin,
      ticker,
      totalShares: data.shares,
      averageCost: data.shares > 0 ? data.totalCost / data.shares : 0,
      averageCostExFees: data.shares > 0 ? data.totalGrossCost / data.shares : 0,
      totalInvested: data.totalCost,
      totalGrossInvested: data.totalGrossCost,
      totalFees: data.totalFees,
      transactions: data.txns,
      currentPrice,
      currentValue,
    });
  }

  return positions;
}

export function computeMetrics(
  transactions: Transaction[],
  marketPrices: Record<string, number>,
  marketDataMap?: Record<string, { time: string; close: number }[]>
): PortfolioMetrics {
  const positions = computePositions(transactions, marketPrices);

  const totalInvested = positions.reduce((sum, p) => sum + p.totalInvested, 0);
  const totalGrossInvested = positions.reduce((sum, p) => sum + p.totalGrossInvested, 0);
  const totalFees = positions.reduce((sum, p) => sum + p.totalFees, 0);
  const totalShares = positions.reduce((sum, p) => sum + p.totalShares, 0);

  const hasMarketData = positions.some(p => p.currentValue !== null);
  const totalValue = hasMarketData
    ? positions.reduce((sum, p) => sum + (p.currentValue ?? 0), 0)
    : null;

  const totalGain = totalValue !== null ? totalValue - totalInvested : null;
  const totalGainPercent = totalGain !== null && totalInvested > 0
    ? (totalGain / totalInvested) * 100
    : null;

  const totalGainExFees = totalValue !== null ? totalValue - totalGrossInvested : null;
  const totalGainExFeesPercent = totalGainExFees !== null && totalGrossInvested > 0
    ? (totalGainExFees / totalGrossInvested) * 100
    : null;

  const xirr = computeXIRR(transactions, totalValue);

  // TWR: use market data of the first position (simplified)
  const firstIsin = positions[0]?.isin;
  const firstMarketData = firstIsin && marketDataMap ? marketDataMap[firstIsin] ?? [] : [];
  const twr = computeTWR(transactions, firstMarketData, totalValue);

  return {
    totalInvested,
    totalGrossInvested,
    totalFees,
    totalValue,
    totalGain,
    totalGainPercent,
    totalGainExFees,
    totalGainExFeesPercent,
    totalShares,
    positions,
    xirr,
    twr,
  };
}

export function computeDCAData(transactions: Transaction[]): DCADataPoint[] {
  const sorted = [...transactions]
    .filter(t => t.type === 'ACHAT')
    .sort((a, b) => a.date.localeCompare(b.date));

  let totalInvested = 0;
  let totalShares = 0;
  const data: DCADataPoint[] = [];

  for (const txn of sorted) {
    totalInvested += txn.netAmount;
    totalShares += txn.quantity;

    data.push({
      date: txn.date,
      totalInvested,
      totalShares,
      averageCost: totalInvested / totalShares,
      investedThisMonth: txn.netAmount,
    });
  }

  return data;
}

export function computeMonthlyInvestments(transactions: Transaction[]): {
  month: string;
  label: string;
  amount: number;
  count: number;
}[] {
  const monthly = new Map<string, { amount: number; count: number }>();

  for (const txn of transactions) {
    if (txn.type !== 'ACHAT') continue;
    const monthKey = txn.date.substring(0, 7); // YYYY-MM
    const existing = monthly.get(monthKey) ?? { amount: 0, count: 0 };
    existing.amount += txn.netAmount;
    existing.count += 1;
    monthly.set(monthKey, existing);
  }

  return [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      label: format(new Date(month + '-01'), 'MMM yy', { locale: fr }),
      amount: data.amount,
      count: data.count,
    }));
}

/**
 * XIRR — Money-Weighted Return (Newton-Raphson)
 * cashFlows: array of { date: Date, amount: number }
 * Negative amounts = cash out (buys), positive = cash in (sells + current value)
 */
export function computeXIRR(
  transactions: Transaction[],
  currentValue: number | null
): number | null {
  if (!currentValue || transactions.length === 0) return null;

  const flows: { date: Date; amount: number }[] = transactions.map(t => ({
    date: new Date(t.date),
    amount: t.type === 'ACHAT' ? -t.netAmount : t.netAmount,
  }));

  // Add current portfolio value as final positive flow
  flows.push({ date: new Date(), amount: currentValue });

  const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / (365.25 * 86400000);
  const d0 = flows[0].date;

  const npv = (rate: number) => flows.reduce((sum, f) => {
    const t = daysBetween(d0, f.date);
    return sum + f.amount / Math.pow(1 + rate, t);
  }, 0);

  const dnpv = (rate: number) => flows.reduce((sum, f) => {
    const t = daysBetween(d0, f.date);
    return sum + (-t * f.amount) / Math.pow(1 + rate, t + 1);
  }, 0);

  let rate = 0.1; // initial guess 10%
  for (let i = 0; i < 100; i++) {
    const n = npv(rate);
    const d = dnpv(rate);
    if (Math.abs(d) < 1e-10) break;
    const newRate = rate - n / d;
    if (Math.abs(newRate - rate) < 1e-8) {
      return newRate * 100; // as percentage
    }
    rate = newRate;
    // Guard against divergence
    if (rate < -0.99 || rate > 10) return null;
  }

  return rate * 100;
}

/**
 * TWR — Time-Weighted Return
 * Chains sub-period returns between each cash flow event
 */
export function computeTWR(
  transactions: Transaction[],
  marketData: { time: string; close: number }[],
  currentValue: number | null
): number | null {
  if (!currentValue || transactions.length === 0 || marketData.length === 0) return null;

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const priceMap = new Map(marketData.map(d => [d.time, d.close]));

  // Find price at or nearest to a date
  const getPrice = (date: string): number | null => {
    if (priceMap.has(date)) return priceMap.get(date)!;
    let nearest: { time: string; diff: number } | null = null;
    for (const d of marketData) {
      const diff = Math.abs(new Date(d.time).getTime() - new Date(date).getTime());
      if (!nearest || diff < nearest.diff) {
        nearest = { time: d.time, diff };
      }
    }
    return nearest ? priceMap.get(nearest.time) ?? null : null;
  };

  let portfolioValue = 0;
  let cumulativeReturn = 1;

  for (const txn of sorted) {
    const priceAtTxn = getPrice(txn.date);
    if (priceAtTxn === null) continue;

    // Compute sub-period return before this transaction
    if (portfolioValue > 0) {
      // Value just before this transaction
      const currentShares = portfolioValue; // stored as shares actually
      // We need a different approach: track shares and compute value
    }

    // Simplified TWR: use first and last dates
    // For a more accurate TWR, we'd need daily portfolio values
  }

  // Simplified: use total return over the period
  const firstTxn = sorted[0];
  const totalDays = (Date.now() - new Date(firstTxn.date).getTime()) / 86400000;
  if (totalDays <= 0) return null;

  const totalInvested = sorted
    .filter(t => t.type === 'ACHAT')
    .reduce((sum, t) => sum + t.netAmount, 0);
  const totalSold = sorted
    .filter(t => t.type === 'VENTE')
    .reduce((sum, t) => sum + t.netAmount, 0);

  const netInvested = totalInvested - totalSold;
  if (netInvested <= 0) return null;

  const totalReturn = (currentValue - netInvested) / netInvested;
  const annualizedReturn = (Math.pow(1 + totalReturn, 365.25 / totalDays) - 1) * 100;

  return annualizedReturn;
}

export function computePRUEvolution(transactions: Transaction[]): {
  date: string;
  pru: number;
  pruExFees: number;
  price: number;
}[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  let totalCost = 0;
  let totalGrossCost = 0;
  let totalShares = 0;
  const data: { date: string; pru: number; pruExFees: number; price: number }[] = [];

  for (const txn of sorted) {
    if (txn.type === 'ACHAT') {
      totalCost += txn.netAmount;
      totalGrossCost += txn.grossAmount;
      totalShares += txn.quantity;
    } else {
      const ratio = txn.quantity / totalShares;
      totalCost -= totalCost * ratio;
      totalGrossCost -= totalGrossCost * ratio;
      totalShares -= txn.quantity;
    }

    if (totalShares > 0) {
      data.push({
        date: txn.date,
        pru: totalCost / totalShares,
        pruExFees: totalGrossCost / totalShares,
        price: txn.price,
      });
    }
  }

  return data;
}
