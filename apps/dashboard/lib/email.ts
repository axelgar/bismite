import "server-only";
import { Resend } from "resend";

// Transactional email via Resend. Used by better-auth for verification + password
// reset (lib/auth.ts). FROM must be a Resend-verified domain in prod; falls back to
// Resend's shared sender (only delivers to your own account email) until then.
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "Bismite <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  // Surface failures so better-auth's call rejects (the action shows an error) rather
  // than silently "succeeding" with no email sent.
  if (error) throw new Error(`resend: ${error.message}`);
}
