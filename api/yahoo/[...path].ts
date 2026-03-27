import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathSegments = req.query.path;
  const pathString = Array.isArray(pathSegments)
    ? pathSegments.join('/')
    : pathSegments ?? '';

  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => queryParams.append(key, v));
    } else if (value !== undefined) {
      queryParams.append(key, value);
    }
  }

  const queryString = queryParams.toString();
  const targetUrl = `https://query1.finance.yahoo.com/${pathString}${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method ?? 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });

    const data = await response.text();

    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Yahoo Finance proxy error:', error);
    res.status(502).json({ error: 'Failed to fetch from Yahoo Finance' });
  }
}
