import "server-only";
import { Resend } from "resend";

// Transactional email via Resend. Used by better-auth for verification + password
// reset (lib/auth.ts). FROM must be a Resend-verified domain in prod; falls back to
// Resend's shared sender (only delivers to your own account email) until then.
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "Bismite <onboarding@resend.dev>";

export async function sendEmail(to: string | string[], subject: string, html: string) {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  // Surface failures so better-auth's call rejects (the action shows an error) rather
  // than silently "succeeding" with no email sent.
  if (error) throw new Error(`resend: ${error.message}`);
}

/** Usage threshold alert email (observability PRD-C #7) — the conversion lever: "you're
 *  at 80% of Free → upgrade". Plain inline-styled HTML; no template engine for one email. */
export function usageAlertEmail(opts: {
  threshold: number;
  mtu: number;
  ceiling: number;
  planName: string;
  upgradeUrl: string;
}): { subject: string; html: string } {
  const { threshold, mtu, ceiling, planName, upgradeUrl } = opts;
  const atLimit = threshold >= 100;
  const subject = atLimit
    ? `You've hit your ${planName} MTU limit`
    : `You're at ${threshold}% of your ${planName} MTU limit`;
  const lead = atLimit
    ? `Your project has reached its ${planName} plan limit of ${ceiling.toLocaleString()} monthly tracked users.`
    : `Your project is at ${threshold}% of its ${planName} plan limit — ${mtu.toLocaleString()} of ${ceiling.toLocaleString()} monthly tracked users this period.`;
  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
    <h2 style="font-size:18px;margin:0 0 12px">${subject}</h2>
    <p style="font-size:14px;line-height:1.5;margin:0 0 16px">${lead}</p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 20px">Upgrade to keep tracking new users without interruption.</p>
    <a href="${upgradeUrl}" style="display:inline-block;background:#7C5CFF;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">Review usage &amp; upgrade</a>
    <p style="font-size:12px;color:#888;margin:24px 0 0">You're receiving this as an owner/admin of this Bismite organization.</p>
  </div>`;
  return { subject, html };
}
