/**
 * GET /api/billing?phone=+15551234567
 * Returns the Stripe card on file (brand, last4, exp_month, exp_year)
 * and a Stripe Customer Portal URL for updating payment details.
 */
const Stripe            = require('stripe');
const { createClient }  = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, STRIPE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Get billing_email from users table
  const { data: user } = await supabase
    .from('users')
    .select('billing_email')
    .eq('phone', phone)
    .maybeSingle();

  const billingEmail = user?.billing_email ?? null;
  if (!billingEmail) return res.json({ card: null, portalUrl: null });

  // 2. Get stripe_customer_id from subscriptions table
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('email', billingEmail)
    .maybeSingle();

  const customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) return res.json({ card: null, portalUrl: null });

  const stripe = Stripe(STRIPE_SECRET_KEY);

  // 3. Fetch default payment method from Stripe
  let card = null;
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    const pm = customer.invoice_settings?.default_payment_method;
    if (pm?.card) {
      card = {
        brand:    pm.card.brand,
        last4:    pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear:  pm.card.exp_year,
      };
    }
  } catch (e) {
    console.error('[billing] failed to fetch payment method:', e.message);
  }

  // 4. Create a Stripe Customer Portal session
  let portalUrl = null;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: 'https://zorrotrade.com',
    });
    portalUrl = session.url;
  } catch (e) {
    console.error('[billing] failed to create portal session:', e.message);
  }

  return res.json({ card, portalUrl });
};
