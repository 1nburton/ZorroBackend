/**
 * GET /api/finnhub?path=/stock/metric&symbol=AAPL&metric=all
 * Proxies requests to Finnhub, injecting the API key server-side.
 * The key never reaches the app bundle.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const { FINNHUB_KEY_1 } = process.env;
  if (!FINNHUB_KEY_1) return res.status(500).json({ error: 'Finnhub key not configured' });

  const { path, ...rest } = req.query;
  if (!path) return res.status(400).json({ error: 'path query param required' });

  // Build Finnhub URL — forward all query params except 'path', add token
  const params = new URLSearchParams({ ...rest, token: FINNHUB_KEY_1 });
  const url    = `https://finnhub.io/api/v1${path}?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);
    const upstream   = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(upstream.status).json(data);
  } catch (e) {
    console.error('[finnhub proxy] error:', e.message);
    return res.status(502).json({ error: 'Upstream error' });
  }
};
