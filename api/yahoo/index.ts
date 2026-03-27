import type { VercelRequest, VercelResponse } from '@vercel/node';

const YAHOO_HOSTS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extract yahoo path from the full request URL
  // /api/yahoo/v8/finance/chart/PUST.PA?range=2y -> /v8/finance/chart/PUST.PA?range=2y
  const url = req.url ?? '';
  const yahooPath = url.replace(/^\/api\/yahoo/, '');

  if (!yahooPath || yahooPath === '/') {
    res.status(400).json({ error: 'Missing path' });
    return;
  }

  for (const host of YAHOO_HOSTS) {
    try {
      const response = await fetch(`${host}${yahooPath}`, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) continue;

      const data = await response.text();
      res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json');
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      res.status(response.status).send(data);
      return;
    } catch {
      continue;
    }
  }

  res.status(502).json({ error: 'Yahoo Finance unavailable' });
}
