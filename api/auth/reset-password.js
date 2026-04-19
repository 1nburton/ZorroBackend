/**
 * POST /api/auth/reset-password
 * Body: { phone, passwordHash }
 * Only callable after phone OTP verification in the app.
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
  const stored   = await bcrypt.hash(passwordHash, 10);

  const { error } = await supabase
    .from('users')
    .update({ password: stored })
    .eq('phone', phone);

  if (error) {
    console.error('[reset-password] error:', error.message);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }

  return res.json({ ok: true });
};
