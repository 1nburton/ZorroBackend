module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param required' });

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'missing env vars' });
  }

  // Use raw REST API instead of SDK to avoid any SDK connection overhead
  try {
    const url = `${SUPABASE_URL}/rest/v1/subscriptions?email=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=status,updated_at&limit=1`;

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      headers: {
        apikey:        SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      console.error('[subscription] supabase error:', response.status, text);
      return res.status(500).json({ error: `Supabase error: ${response.status}` });
    }

    const rows = await response.json();
    const data = rows?.[0] ?? null;
    return res.json({ status: data?.status ?? 'none', updatedAt: data?.updated_at ?? null });
  } catch (e) {
    console.error('[subscription] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
