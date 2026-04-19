/**
 * GET /api/subscription?phone=+15551234567
 * Looks up the user's billing_email by phone, then checks the subscriptions table.
 * Returns { status, updatedAt }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone query param required' });

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'missing env vars' });
  }

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 4000);
    const headers    = {
      apikey:          SUPABASE_SERVICE_KEY,
      Authorization:   `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
    };

    // Step 1: get user's billing_email by phone
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?phone=eq.${encodeURIComponent(phone)}&select=billing_email&limit=1`,
      { headers, signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!userRes.ok) {
      const text = await userRes.text();
      console.error('[subscription] user lookup error:', userRes.status, text);
      return res.status(500).json({ error: `Supabase error: ${userRes.status}` });
    }

    const users        = await userRes.json();
    const billingEmail = users?.[0]?.billing_email ?? null;

    // No billing email means they've never started a Stripe subscription
    if (!billingEmail) {
      return res.json({ status: 'none', updatedAt: null });
    }

    // Step 2: check subscriptions table by billing_email
    const controller2 = new AbortController();
    const timeout2    = setTimeout(() => controller2.abort(), 4000);

    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?email=eq.${encodeURIComponent(billingEmail)}&select=status,updated_at&limit=1`,
      { headers, signal: controller2.signal }
    );
    clearTimeout(timeout2);

    if (!subRes.ok) {
      const text = await subRes.text();
      console.error('[subscription] subscriptions lookup error:', subRes.status, text);
      return res.status(500).json({ error: `Supabase error: ${subRes.status}` });
    }

    const rows = await subRes.json();
    const data = rows?.[0] ?? null;
    return res.json({ status: data?.status ?? 'none', updatedAt: data?.updated_at ?? null });

  } catch (e) {
    console.error('[subscription] error:', e.message, e.cause?.message);
    return res.status(500).json({ error: e.message, cause: e.cause?.message ?? null });
  }
};
