/**
 * DELETE /api/auth/delete-account
 * Body: { phone }
 * Removes the user row from the users table.
 */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { phone } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('phone', phone);

  if (error) return res.status(500).json({ error: 'Internal error' });

  return res.status(200).json({ ok: true });
};
