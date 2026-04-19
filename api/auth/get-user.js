/**
 * GET /api/auth/get-user?phone=+15551234567
 * Returns public user fields (no password). Used on app launch to refresh session.
 */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase
    .from('users')
    .select('phone, plan, pro_until, billing_email')
    .eq('phone', phone)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Internal error' });
  if (!data)  return res.status(404).json({ error: 'User not found' });

  return res.json({
    phone:        data.phone,
    plan:         data.plan          ?? 'free',
    proUntil:     data.pro_until     ?? null,
    billingEmail: data.billing_email ?? null,
  });
};
