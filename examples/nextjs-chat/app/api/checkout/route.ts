import { stripe } from "../../../lib/stripe";

// Issue #3: the upgrade loop. `check()` returns this URL when a user is over
// limit; it creates a Stripe Checkout session and redirects them to pay.
// On success the webhook (#2) flips their plan — no deploy, instant unlock.
export async function GET(req: Request) {
  if (!stripe) return new Response("Stripe not configured", { status: 500 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? "demo-user";
  const priceId = process.env.STRIPE_PRICE_PRO;
  if (!priceId) return new Response("STRIPE_PRICE_PRO not set", { status: 500 });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId, // how the webhook ties the payment back to our user
    success_url: `${url.origin}/?upgraded=1`,
    cancel_url: `${url.origin}/`,
  });

  return Response.redirect(session.url!, 303);
}
