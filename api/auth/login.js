/**
 * POST /api/auth/login
 * Body: { email, passwordHash }
 * Returns: { email, plan, proUntil }
 */
const bcrypt       = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { email, passwordHash } = req.body ?? {};
  if (!email || !passwordHash) {
    return res.status(400).json({ error: 'email and passwordHash are required' });
  }

  const norm     = email.trim().toLowerCase();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: user, error } = await supabase
    .from('users')
    .select('email, password, plan, pro_until, phone')
    .eq('email', norm)
    .maybeSingle();

  if (error) {
    console.error('[login] query error:', error.message);
    return res.status(500).json({ error: 'Internal error' });
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const match = await bcrypt.compare(passwordHash, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json({
    email:    user.email,
    plan:     user.plan    ?? 'free',
    proUntil: user.pro_until ?? null,
    phone:    user.phone   ?? null,
  });
};
