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
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('billing_email')
    .eq('phone', phone)
    .maybeSingle();

  console.log('[billing] user lookup:', { phone, billingEmail: user?.billing_email, userErr: userErr?.message });

  const billingEmail = user?.billing_email ?? null;
  if (!billingEmail) return res.json({ card: null, portalUrl: null, debug: 'no billing_email' });

  // 2. Get stripe_customer_id + subscription_id from subscriptions table
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('email', billingEmail)
    .maybeSingle();

  console.log('[billing] sub lookup:', { billingEmail, customerId: sub?.stripe_customer_id, subErr: subErr?.message });

  const customerId     = sub?.stripe_customer_id     ?? null;
  const subscriptionId = sub?.stripe_subscription_id ?? null;
  if (!customerId) return res.json({ card: null, portalUrl: null, debug: 'no stripe_customer_id' });

  const stripe = Stripe(STRIPE_SECRET_KEY);

  // 3. Fetch payment method — check customer default first, then subscription default
  let card = null;
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });

    let pm = customer.invoice_settings?.default_payment_method ?? null;
    console.log('[billing] customer pm:', pm?.id ?? 'none');

    // Fallback: check subscription's default_payment_method
    if (!pm && subscriptionId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['default_payment_method'],
        });
        pm = stripeSub.default_payment_method ?? null;
        console.log('[billing] subscription pm:', pm?.id ?? 'none');
      } catch (e) {
        console.error('[billing] subscription retrieve error:', e.message);
      }
    }

    // Fallback: list all payment methods and take the first card
    if (!pm) {
      const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
      pm = pms.data?.[0] ?? null;
      console.log('[billing] listed pm:', pm?.id ?? 'none');
    }

    if (pm?.card) {
      card = {
        brand:    pm.card.brand,
        last4:    pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear:  pm.card.exp_year,
      };
    }
  } catch (e) {
    console.error('[billing] payment method fetch error:', e.message);
  }

  console.log('[billing] card result:', card);

  // 4. Create a Stripe Customer Portal session
  let portalUrl = null;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: 'https://zorrotrade.com',
    });
    portalUrl = session.url;
  } catch (e) {
    // Portal not activated in Stripe dashboard — not a blocking error
    console.error('[billing] portal session error:', e.message);
  }

  return res.json({ card, portalUrl });
};
