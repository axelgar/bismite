import { stripe, overageEnabled, METER_EVENT_MTU_OVERAGE } from "@/lib/stripe";
import { listOrgsWithCustomer } from "@/lib/org";
import { orgUsage, overageDelta, unbankOverage } from "@/lib/counter";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs"; // Stripe SDK + the counter admin call need Node

// Daily overage reconcile (v2/B #8). For every PRO org, compute its authoritative MTU
// overage from the counter and push only the not-yet-reported DELTA to the Stripe Meter,
// keyed to the org's customer. Reconciling from the authoritative total (not incremental
// events) means a missed run self-heals: the next run's delta catches up.
//
// Ordering (v2/B review fix): the counter banks the delta, then we push to Stripe; if the
// push throws we UN-bank so the next run retries instead of silently dropping it. The old
// order lost the delta forever on any Stripe error.
//
// Guarded by CRON_SECRET (Vercel sends it as a bearer). Fails CLOSED if the secret is unset
// so an unconfigured deploy can't be triggered publicly to manufacture billing.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("cron not configured", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  // Inert until the metered price is configured — a flat Pro tier needs no reconcile.
  if (!overageEnabled) return Response.json({ skipped: "overage not configured" });

  const included = PLANS.pro.mtuIncluded; // €0 up to here; €8/1k above
  const orgs = await listOrgsWithCustomer();
  let reported = 0;
  let skipped = 0;
  let failed = 0;

  for (const org of orgs) {
    try {
      // Gate on the ENFORCED plan, not merely "has a customer id": a canceled/downgraded org
      // keeps its id but flips back to free, and Enterprise is custom — neither bills overage.
      const { mtu, plan } = await orgUsage(org.id);
      if (plan !== "pro") {
        skipped++;
        continue;
      }
      const overage = Math.max(0, mtu - included);
      // Counter banks the total and hands back only the unreported portion.
      const { delta } = await overageDelta(org.id, overage);
      if (delta <= 0) continue;
      try {
        await stripe.billing.meterEvents.create({
          event_name: METER_EVENT_MTU_OVERAGE,
          payload: { stripe_customer_id: org.stripeCustomerId, value: String(delta) },
        });
      } catch (stripeErr) {
        // Roll the bank back so this delta is retried next run rather than lost.
        await unbankOverage(org.id, delta).catch((e) =>
          console.error(`overage unbank failed for org ${org.id} (delta ${delta} stuck):`, e),
        );
        throw stripeErr;
      }
      reported++;
    } catch (err) {
      // One org's failure must not abort the sweep; the next run reconciles it.
      console.error(`overage reconcile failed for org ${org.id}:`, err);
      failed++;
    }
  }
  return Response.json({ orgs: orgs.length, reported, skipped, failed });
}
