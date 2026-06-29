import type Stripe from "stripe";
import { stripe, WEBHOOK_SECRET } from "@/lib/stripe";
import { setBilling } from "@/lib/counter";

// Stripe is the source of truth for paid plans (#6). This verified webhook is the ONLY
// place that flips a project to/from Pro — no user action can. projectId rides on the
// checkout session and the subscription metadata, so each event maps to one project.
export const runtime = "nodejs"; // signature verification + the BFF admin call need Node

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) return new Response("billing not configured", { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("stripe webhook signature failed:", (err as Error).message);
    return new Response("invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const projectId = s.metadata?.projectId ?? s.client_reference_id;
        const customer = typeof s.customer === "string" ? s.customer : s.customer?.id;
        if (projectId) await setBilling(projectId, "pro", customer ?? undefined);
        break;
      }
      // Cancel / lapse via the Customer Portal => back to Free. Keep the customer id so a
      // returning user resubscribes onto the same Stripe customer.
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.projectId) await setBilling(sub.metadata.projectId, "free");
        break;
      }
      // Status changes (past_due -> canceled, reactivation, etc.): active/trialing => Pro,
      // anything else => Free. Idempotent, so redelivered events are safe.
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.projectId) {
          const active = sub.status === "active" || sub.status === "trialing";
          await setBilling(sub.metadata.projectId, active ? "pro" : "free");
        }
        break;
      }
    }
  } catch (err) {
    // 500 => Stripe retries with backoff. setBilling is idempotent, so retries are safe.
    console.error("stripe webhook handler error:", err);
    return new Response("handler error", { status: 500 });
  }
  return new Response("ok");
}
