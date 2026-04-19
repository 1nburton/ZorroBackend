/**
 * POST /api/auth/register
 * Body: { phone, passwordHash, plan }
 *
 * Phone is the primary identifier. No email required.
 * passwordHash is SHA-256 pre-hash from client; bcrypted server-side.
 */
const bcrypt           = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { phone, passwordHash, plan } = req.body ?? {};
  if (!phone || !passwordHash) {
    return res.status(400).json({ error: 'phone and passwordHash are required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Check if phone already exists
  const { data: existing } = await supabase
    .from('users')
    .select('phone')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'An account with this phone number already exists.' });
  }

  const stored = await bcrypt.hash(passwordHash, 10);

  const { error } = await supabase.from('users').insert({
    phone,
    password: stored,
    plan:     plan ?? 'free',
  });

  if (error) {
    console.error('[register] insert error:', error.message);
    return res.status(500).json({ error: 'Failed to create account.' });
  }

  return res.status(201).json({ phone, plan: plan ?? 'free' });
};
