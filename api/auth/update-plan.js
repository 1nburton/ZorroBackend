/**
 * POST /api/auth/update-plan
 * Body: { phone, plan?, proUntil?, billingEmail? }
 *
 * Updates plan and/or billing_email for a user identified by phone.
 * billingEmail is saved so the Stripe webhook can link payments back to this user.
 */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { phone, plan, proUntil, billingEmail } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const updates = {};
  if (plan        !== undefined) updates.plan      = plan;
  if (proUntil    !== undefined) updates.pro_until = proUntil ?? null;
  if (billingEmail !== undefined) updates.billing_email = billingEmail.trim().toLowerCase();

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('phone', phone);

  if (error) {
    console.error('[update-plan] error:', error.message);
    return res.status(500).json({ error: 'Failed to update.' });
  }

  return res.json({ ok: true });
};
