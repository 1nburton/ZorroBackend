/**
 * POST /api/auth/register
 * Body: { email, passwordHash, phone, plan }
 *
 * Note: the app sends a SHA-256 pre-hash of the password so the raw password
 * never travels over the network. We bcrypt that hash server-side before storing.
 */
const bcrypt       = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { email, passwordHash, phone, plan } = req.body ?? {};
  if (!email || !passwordHash || !phone) {
    return res.status(400).json({ error: 'email, passwordHash and phone are required' });
  }

  const norm = email.trim().toLowerCase();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Check if email already exists
  const { data: existing } = await supabase
    .from('users')
    .select('email')
    .eq('email', norm)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  // bcrypt the pre-hash (cost factor 10 is fine for a pre-hashed input)
  const stored = await bcrypt.hash(passwordHash, 10);

  const { error } = await supabase.from('users').insert({
    email:    norm,
    password: stored,
    phone:    phone,
    plan:     plan ?? 'free',
  });

  if (error) {
    console.error('[register] insert error:', error.message);
    return res.status(500).json({ error: 'Failed to create account.' });
  }

  return res.status(201).json({ email: norm, plan: plan ?? 'free' });
};
