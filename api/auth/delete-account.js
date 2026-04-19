/**
 * DELETE /api/auth/delete-account
 * Body: { email }
 * Removes the user row from the users table.
 */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'email required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('email', email.trim().toLowerCase());

  if (error) return res.status(500).json({ error: 'Internal error' });

  return res.status(200).json({ ok: true });
};
