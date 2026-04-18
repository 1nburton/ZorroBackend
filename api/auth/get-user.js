/**
 * GET /api/auth/get-user?email=user@example.com
 * Returns public user fields (no password). Used on app launch to refresh session.
 */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase
    .from('users')
    .select('email, plan, pro_until, phone')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Internal error' });
  if (!data)  return res.status(404).json({ error: 'User not found' });

  return res.json({
    email:    data.email,
    plan:     data.plan     ?? 'free',
    proUntil: data.pro_until ?? null,
    phone:    data.phone    ?? null,
  });
};
