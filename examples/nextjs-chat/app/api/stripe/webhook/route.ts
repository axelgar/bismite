import { stripe } from "../../../../lib/stripe";
import { setPlan, linkCustomer, userForCustomer } from "../../../../lib/plan-store";
import { planForSubscription } from "../../../../bismite.config";

// Issue #2: Stripe is the source of truth for a user's plan.
// Verifies the signature, then keeps our local plan state in sync.
export async function POST(req: Request) {
  if (!stripe) return new Response("Stripe not configured", { status: 500 });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new Response("missing signature/secret", { status: 400 });

  const body = await req.text(); // raw body required for signature verification
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (err) {
    return new Response(`bad signature: ${(err as Error).message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.client_reference_id && s.customer) {
        linkCustomer(s.client_reference_id, String(s.customer));
      }
      if (s.client_reference_id && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(String(s.subscription));
        setPlan(s.client_reference_id, planForSubscription(sub.status, sub.items.data[0]?.price.id));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = userForCustomer(String(sub.customer));
      if (userId) setPlan(userId, planForSubscription(sub.status, sub.items.data[0]?.price.id));
      break;
    }
  }

  return Response.json({ received: true });
}
