import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Transaction } from './types';
import { ISIN_TO_NAME } from './types';
import { parseEurAmount, generateId } from './utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function parseBoursoAvis(file: File): Promise<Transaction | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .map((item) => item.str)
      .join(' ');

    // Type: ACHAT or VENTE
    const type = /VENTE\s+COMPTANT/i.test(text) ? 'VENTE' as const : 'ACHAT' as const;

    // Date + time from execution details (DD/MM/YYYY HH:MM:SS)
    const dateTimeMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    if (!dateTimeMatch) return null;
    const [, dateStr, time] = dateTimeMatch;
    const [day, month, year] = dateStr.split('/');
    const date = `${year}-${month}-${day}`;

    // ISIN
    const isinMatch = text.match(/Code\s+ISIN\s*:?\s*([A-Z]{2}[\w]{10})/);
    const isin = isinMatch?.[1] ?? '';

    // Price (cours exécuté) - handle both "exécuté" and "execute"
    const priceMatch = text.match(/Cours\s+(?:ex[ée]cut[ée]|d'ex[ée]cution)\s*:?\s*([\d\s,]+?)\s*EUR/i);
    const price = priceMatch ? parseEurAmount(priceMatch[1]) : 0;

    // Market
    const marketMatch = text.match(/Lieu\s+d'ex[ée]cution\s*:?\s*([A-Z][A-Z\s]+?)(?:\s{2}|Montant|$)/i);
    const market = marketMatch?.[1]?.trim() ?? '';

    // Reference number for deduplication
    const refMatch = text.match(/R[ée]f[ée]rence\s*:?\s*(\d+)/i);
    const reference = refMatch?.[1] ?? '';

    // Amounts: extract all EUR amounts after "Montant brut"
    const montantIndex = text.indexOf('Montant brut');
    if (montantIndex === -1) return null;
    const amountsSection = text.substring(montantIndex);
    const eurMatches = [...amountsSection.matchAll(/([\d\s]+,\d{2})\s*EUR/g)];
    const amounts = eurMatches.map(m => parseEurAmount(m[1]));

    if (amounts.length < 3) return null;

    const grossAmount = amounts[0];
    const netAmount = amounts[amounts.length - 1];
    // Commission is always the second amount
    const commission = amounts[1];
    // TTF fees if present (4 amounts total)
    const fees = amounts.length >= 4 ? amounts[2] : 0;

    // Quantity: derive from gross amount / price (more robust than text extraction)
    const quantity = price > 0 ? Math.round(grossAmount / price) : 0;

    // Name: try to extract from text, fallback to ISIN mapping
    let name = ISIN_TO_NAME[isin] ?? isin;
    const nameMatch = text.match(/\d{2}:\d{2}:\d{2}\s+\d+\s+(.+?)\s+R[ée]f/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    return {
      id: reference || generateId(),
      date,
      time,
      type,
      name,
      isin,
      quantity,
      price,
      grossAmount,
      commission,
      fees,
      netAmount,
      market,
      reference,
    };
  } catch (err) {
    console.error(`Error parsing PDF ${file.name}:`, err);
    return null;
  }
}

export async function parseBoursoFiles(files: File[]): Promise<Transaction[]> {
  const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
  const results = await Promise.all(pdfFiles.map(parseBoursoAvis));

  const transactions = results.filter((t): t is Transaction => t !== null);

  // Deduplicate by reference number
  const seen = new Set<string>();
  const unique = transactions.filter(t => {
    if (t.reference && seen.has(t.reference)) return false;
    if (t.reference) seen.add(t.reference);
    return true;
  });

  // Sort by date ascending
  unique.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.time.localeCompare(b.time);
  });

  return unique;
}
