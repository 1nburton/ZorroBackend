const Stripe           = require('stripe');
const { createClient } = require('@supabase/supabase-js');

async function upsert(supabase, email, status, customerId, subscriptionId) {
  console.log('[webhook] upsert', email, status);
  const { error } = await supabase.from('subscriptions').upsert(
    {
      email:                  email.toLowerCase(),
      status,
      stripe_customer_id:     customerId     ?? null,
      stripe_subscription_id: subscriptionId ?? null,
      updated_at:             new Date().toISOString(),
    },
    { onConflict: 'email' }
  );
  if (error) console.error('[webhook] upsert error', error.message);
}

async function emailFromCustomer(stripe, customerId) {
  try {
    const c = await stripe.customers.retrieve(customerId);
    return c.deleted ? null : c.email;
  } catch (e) {
    console.error('[webhook] emailFromCustomer error', e.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[webhook] missing env vars', {
      hasStripeKey:     !!STRIPE_SECRET_KEY,
      hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
      hasSupabaseUrl:   !!SUPABASE_URL,
      hasSupabaseKey:   !!SUPABASE_SERVICE_KEY,
    });
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const stripe   = Stripe(STRIPE_SECRET_KEY);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Collect raw body from stream
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end',  ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  console.log('[webhook] raw body length:', rawBody.length);
  console.log('[webhook] stripe-signature present:', !!req.headers['stripe-signature']);

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return res.status(400).json({ error: `Signature error: ${err.message}` });
  }

  console.log('[webhook] event type:', event.type);
  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const email = obj.customer_details?.email ?? obj.customer_email;
      console.log('[webhook] checkout completed, email:', email);
      if (email) await upsert(supabase, email, 'active', obj.customer, obj.subscription);
      break;
    }
    case 'customer.subscription.updated': {
      const email = await emailFromCustomer(stripe, obj.customer);
      if (email) {
        const status = obj.status === 'active'  ? 'active'
                     : obj.status === 'past_due' ? 'past_due'
                     : obj.status === 'trialing' ? 'active'
                     : 'cancelled';
        await upsert(supabase, email, status, obj.customer, obj.id);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const email = await emailFromCustomer(stripe, obj.customer);
      if (email) await upsert(supabase, email, 'cancelled', obj.customer, obj.id);
      break;
    }
    case 'invoice.payment_failed': {
      const email = obj.customer_email ?? await emailFromCustomer(stripe, obj.customer);
      if (email) await upsert(supabase, email, 'past_due', obj.customer, obj.subscription);
      break;
    }
  }

  res.json({ received: true });
};
