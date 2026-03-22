// API endpoint: POST /api/webhook
// Receives Stripe webhook events when a payment is completed
// Stores premium users in a simple JSON via Vercel KV or in-memory fallback

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// In-memory store (will use Vercel KV in production for persistence)
// For now we use the Stripe API directly to check subscription status
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let event;
  try {
    // Get raw body for signature verification
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    if (WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    } else {
      event = JSON.parse(rawBody);
    }
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('✅ Payment completed for:', session.customer_email);
      // The customer email is stored in Stripe — we'll query it in /api/check
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log('❌ Subscription cancelled:', sub.id);
      break;
    }
    default:
      console.log('Unhandled event:', event.type);
  }

  res.status(200).json({ received: true });
};

// Disable body parsing so we get raw body for signature verification
module.exports.config = { api: { bodyParser: false } };
