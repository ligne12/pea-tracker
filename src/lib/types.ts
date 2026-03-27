export interface Transaction {
  id: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM:SS
  type: 'ACHAT' | 'VENTE';
  name: string;
  isin: string;
  quantity: number;
  price: number;       // cours exécuté
  grossAmount: number; // montant brut
  commission: number;
  fees: number;        // frais TTF
  netAmount: number;   // montant net
  market: string;
  reference: string;
}

export interface Position {
  isin: string;
  name: string;
  ticker: string;
  totalShares: number;
  averageCost: number;    // PRU (including fees)
  averageCostExFees: number; // PRU (excluding fees)
  totalInvested: number;  // total net amounts (cash out)
  totalGrossInvested: number;
  totalFees: number;
  transactions: Transaction[];
  currentPrice: number | null;
  currentValue: number | null;
}

export interface MarketDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DCADataPoint {
  date: string;
  totalInvested: number;
  totalShares: number;
  averageCost: number;
  investedThisMonth: number;
}

export interface PortfolioMetrics {
  totalInvested: number;
  totalGrossInvested: number;
  totalFees: number;
  totalValue: number | null;
  totalGain: number | null;
  totalGainPercent: number | null;
  totalGainExFees: number | null;
  totalGainExFeesPercent: number | null;
  totalShares: number;
  positions: Position[];
  xirr: number | null;       // annualized money-weighted return
  twr: number | null;        // time-weighted return (annualized)
}

export const ISIN_TO_TICKER: Record<string, string> = {
  'FR0011871110': 'PUST.PA',
  'FR0013412285': 'PSP5.PA',
  'FR0013412038': 'PCEU.PA',
  'FR0011869353': 'PAEEM.PA',
  'FR0013412012': 'EWLD.PA',
  'LU1681043599': 'CW8.PA',
  'FR0011550185': 'EWLD.PA',
  'FR0007052782': 'LQQ.PA',
  'LU1681038599': 'MWRD.PA',
  'FR0010315770': 'LVC.PA',
  'FR0013380607': 'PLEM.PA',
};

export const ISIN_TO_NAME: Record<string, string> = {
  'FR0011871110': 'Amundi PEA Nasdaq-100 UCITS ETF Acc',
  'FR0013412285': 'Amundi PEA S&P 500 UCITS ETF Acc',
  'FR0013412038': 'Amundi PEA MSCI Europe UCITS ETF Acc',
  'FR0011869353': 'Amundi PEA MSCI Emerging Markets UCITS ETF Acc',
  'FR0013412012': 'Amundi PEA MSCI World UCITS ETF Acc',
  'LU1681043599': 'Amundi MSCI World UCITS ETF Acc',
  'FR0011550185': 'Lyxor MSCI World PEA UCITS ETF',
  'FR0007052782': 'Amundi Leveraged Nasdaq-100 Daily UCITS ETF',
};
