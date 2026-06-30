import { stripe, overageEnabled, METER_EVENT_MTU_OVERAGE } from "@/lib/stripe";
import { listOrgsWithCustomer } from "@/lib/org";
import { orgUsage, overageDelta } from "@/lib/counter";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs"; // Stripe SDK + the counter admin call need Node

// Daily overage reconcile (v2/B #8). For every org that has subscribed, compute its
// authoritative MTU overage from the counter and push only the not-yet-reported DELTA to the
// Stripe Meter, keyed to the org's customer. Reconciling from the authoritative total (not
// incremental events) means a missed run self-heals: the next run's delta catches up. The
// counter banks what's been reported, so a sum-aggregated Meter never double-counts.
//
// Guarded by CRON_SECRET (Vercel cron sends it as a bearer). Wire a daily Vercel cron at
// `/api/cron/reconcile-overage` (see vercel.ts / dashboard cron config).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  // Inert until the metered price is configured — a flat Pro tier needs no reconcile.
  if (!overageEnabled) return Response.json({ skipped: "overage not configured" });

  const included = PLANS.pro.mtuIncluded; // €0 up to here; €8/1k above
  const orgs = await listOrgsWithCustomer();
  let reported = 0;
  let failed = 0;

  for (const org of orgs) {
    try {
      const { mtu } = await orgUsage(org.id);
      const overage = Math.max(0, mtu - included);
      // Counter banks the total and hands back only the unreported portion.
      const { delta } = await overageDelta(org.id, overage);
      if (delta <= 0) continue;
      await stripe.billing.meterEvents.create({
        event_name: METER_EVENT_MTU_OVERAGE,
        payload: { stripe_customer_id: org.stripeCustomerId, value: String(delta) },
      });
      reported++;
    } catch (err) {
      // One org's failure must not abort the sweep; the next run reconciles it.
      console.error(`overage reconcile failed for org ${org.id}:`, err);
      failed++;
    }
  }
  return Response.json({ orgs: orgs.length, reported, failed });
}
