import { listAllOrgIds, orgAdminEmails } from "@/lib/org";
import { orgUsage } from "@/lib/counter";
import { sendEmail, usageAlertEmail } from "@/lib/email";
import { thresholdToAlert, lastAlertedThreshold, recordAlertThreshold } from "@/lib/alerts";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs"; // Resend + the counter admin call need Node

const APP_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";

// Daily threshold-alert sweep (observability PRD-C #7). For every org, compare its
// authoritative period MTU (from the counter) against its plan's included ceiling; on the
// first crossing of 80% / 100% this period, email the org's owners/admins an upgrade nudge.
// De-duped via usage_alerts so each threshold sends at most once a period.
//
// Guarded by CRON_SECRET (Vercel cron sends it as a bearer). Fails CLOSED if the secret is
// unset so an unconfigured deploy can't be publicly triggered. Wired to a daily Vercel cron.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("cron not configured", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const orgIds = await listAllOrgIds();
  let alerted = 0;
  let failed = 0;

  for (const orgId of orgIds) {
    try {
      // Size the ceiling off the ENFORCED plan from the counter (not a Stripe-customer
      // proxy) so a canceled org being hard-blocked at 1k is alerted against 1k, not 10k.
      const { mtu, period, plan } = await orgUsage(orgId);
      const ceiling = PLANS[plan].mtuIncluded;
      const planName = PLANS[plan].name;

      const last = await lastAlertedThreshold(orgId, period);
      const threshold = thresholdToAlert(mtu, ceiling, last);
      if (threshold === 0) continue; // not over a new threshold => no email

      const recipients = await orgAdminEmails(orgId);
      if (recipients.length === 0) continue; // nobody to tell

      const { subject, html } = usageAlertEmail({
        threshold,
        mtu,
        ceiling,
        planName,
        upgradeUrl: `${APP_URL}/dashboard`,
      });
      await sendEmail(recipients, subject, html);
      // ponytail: send then record — not atomic (neon-http has no transactions). A crash
      // between them re-sends this threshold next run (at-least-once); the inverse order
      // would LOSE alerts, so this is the safe side of the trade.
      await recordAlertThreshold(orgId, period, threshold);
      alerted++;
    } catch (err) {
      // One org's failure must not abort the sweep; the next run retries it (and the
      // threshold isn't recorded, so no email is lost).
      console.error(`usage-alert failed for org ${orgId}:`, err);
      failed++;
    }
  }

  return Response.json({ orgs: orgIds.length, alerted, failed });
}
