/**
 * POST /api/auth/update-plan
 * Body: { email, plan, proUntil }
 * Called by the app when a user upgrades or downgrades.
 * In production this should be driven by Stripe webhooks only —
 * this endpoint is a convenience for the manual Stripe link flow.
 */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { email, plan, proUntil } = req.body ?? {};
  if (!email || !plan) return res.status(400).json({ error: 'email and plan required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { error } = await supabase
    .from('users')
    .update({ plan, pro_until: proUntil ?? null })
    .eq('email', email.trim().toLowerCase());

  if (error) {
    console.error('[update-plan] error:', error.message);
    return res.status(500).json({ error: 'Failed to update plan.' });
  }

  return res.json({ ok: true });
};
