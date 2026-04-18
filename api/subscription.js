const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param required' });

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  console.log('[subscription] env check', { hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_SERVICE_KEY });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
    global: { fetch: (url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(4000) }) },
  });

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, updated_at')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('[subscription] query error:', error.message, error.code);
      return res.status(500).json({ error: error.message });
    }

    console.log('[subscription] result:', data);
    return res.json({ status: data?.status ?? 'none', updatedAt: data?.updated_at ?? null });
  } catch (e) {
    console.error('[subscription] fetch error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
