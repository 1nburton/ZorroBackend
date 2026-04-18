/**
 * POST /api/webhook
 * Receives Stripe webhook events and syncs subscription status to Supabase.
 *
 * Events handled:
 *   checkout.session.completed   → status = 'active'
 *   customer.subscription.updated → mirrors Stripe status
 *   customer.subscription.deleted → status = 'cancelled'
 *   invoice.payment_failed        → status = 'past_due'
 */

const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service role key — never expose to client
);

// Vercel must not parse the body — Stripe needs the raw bytes to verify signature
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function upsert(email, status, customerId, subscriptionId) {
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
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
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

  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const email = obj.customer_details?.email ?? obj.customer_email;
      if (email) await upsert(email, 'active', obj.customer, obj.subscription);
      break;
    }

    case 'customer.subscription.updated': {
      const email = await emailFromCustomer(obj.customer);
      if (email) {
        // Map Stripe statuses → our simplified set
        const status = obj.status === 'active'   ? 'active'
                     : obj.status === 'past_due'  ? 'past_due'
                     : obj.status === 'trialing'  ? 'active'
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

    default:
      // Ignore unhandled event types
      break;
  }

  res.json({ received: true });
}
