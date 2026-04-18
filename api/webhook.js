const stripe        = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Vercel must not parse the body — Stripe needs raw bytes to verify signature
module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function upsert(email, status, customerId, subscriptionId) {
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

async function emailFromCustomer(customerId) {
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

  const sig     = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('[webhook] received event:', event.type);
  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const email = obj.customer_details?.email ?? obj.customer_email;
      console.log('[webhook] checkout completed, email:', email);
      if (email) await upsert(email, 'active', obj.customer, obj.subscription);
      break;
    }
    case 'customer.subscription.updated': {
      const email = await emailFromCustomer(obj.customer);
      if (email) {
        const status = obj.status === 'active'  ? 'active'
                     : obj.status === 'past_due' ? 'past_due'
                     : obj.status === 'trialing' ? 'active'
                     : 'cancelled';
        await upsert(email, status, obj.customer, obj.id);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const email = await emailFromCustomer(obj.customer);
      if (email) await upsert(email, 'cancelled', obj.customer, obj.id);
      break;
    }
    case 'invoice.payment_failed': {
      const email = obj.customer_email ?? await emailFromCustomer(obj.customer);
      if (email) await upsert(email, 'past_due', obj.customer, obj.subscription);
      break;
    }
  }

  res.json({ received: true });
};
