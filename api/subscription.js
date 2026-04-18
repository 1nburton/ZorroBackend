/**
 * GET /api/subscription?email=user@example.com
 * Returns the current Pro subscription status for a given email.
 *
 * Response: { status: 'active' | 'past_due' | 'cancelled' | 'none' }
 *
 * The app treats 'active' as Pro. Everything else downgrades to free.
 * On network error the app should NOT downgrade (fail open).
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param required' });

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, updated_at')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error('[subscription] query error:', error.message);
    return res.status(500).json({ error: 'Internal error' });
  }

  // No record = never subscribed
  if (!data) return res.json({ status: 'none' });

  return res.json({ status: data.status, updatedAt: data.updated_at });
}
