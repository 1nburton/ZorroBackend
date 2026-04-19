/**
 * POST /api/auth/login
 * Body: { phone, passwordHash }
 * Returns: { phone, plan, proUntil, billingEmail }
 */
const bcrypt           = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { phone, passwordHash } = req.body ?? {};
  if (!phone || !passwordHash) {
    return res.status(400).json({ error: 'phone and passwordHash are required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: user, error } = await supabase
    .from('users')
    .select('phone, password, plan, pro_until, billing_email')
    .eq('phone', phone)
    .maybeSingle();

  if (error) {
    console.error('[login] query error:', error.message);
    return res.status(500).json({ error: 'Internal error' });
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid phone number or password.' });
  }

  const match = await bcrypt.compare(passwordHash, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid phone number or password.' });
  }

  return res.json({
    phone:        user.phone,
    plan:         user.plan          ?? 'free',
    proUntil:     user.pro_until     ?? null,
    billingEmail: user.billing_email ?? null,
  });
};
