import { listAllOrgs, orgAdminEmails } from "@/lib/org";
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
// Guarded by CRON_SECRET (Vercel cron sends it as a bearer). Wired to a daily Vercel cron.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const orgs = await listAllOrgs();
  let alerted = 0;
  let failed = 0;

  for (const org of orgs) {
    try {
      // ponytail: tier = ever-subscribed → Pro ceiling, else Free. Uses the dashboard's own
      // org.stripeCustomerId, so no counter round-trip and no per-project-plan quirk. A
      // canceled org keeps its id (alerts against Pro's 10k, under-nudges); read the
      // counter's enforced plan here if that miss ever matters.
      const ceiling = org.hasCustomer ? PLANS.pro.mtuIncluded : PLANS.free.mtuIncluded;
      const planName = org.hasCustomer ? PLANS.pro.name : PLANS.free.name;

      const { mtu, period } = await orgUsage(org.id);
      const last = await lastAlertedThreshold(org.id, period);
      const threshold = thresholdToAlert(mtu, ceiling, last);
      if (threshold === 0) continue; // not over a new threshold => no email

      const recipients = await orgAdminEmails(org.id);
      if (recipients.length === 0) continue; // nobody to tell

      const { subject, html } = usageAlertEmail({
        threshold,
        mtu,
        ceiling,
        planName,
        upgradeUrl: `${APP_URL}/dashboard`,
      });
      await sendEmail(recipients, subject, html);
      await recordAlertThreshold(org.id, period, threshold);
      alerted++;
    } catch (err) {
      // One org's failure must not abort the sweep; the next run retries it (and the
      // threshold isn't recorded, so no email is lost).
      console.error(`usage-alert failed for org ${org.id}:`, err);
      failed++;
    }
  }

  return Response.json({ orgs: orgs.length, alerted, failed });
}
