// better-auth server instance — buy auth, don't build it (PRD §9). Email+password for v1.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db } from "./db";
import { sendEmail } from "./email";

// Minimal branded HTML for the transactional emails (better-auth hands us a ready `url`).
const emailHtml = (intro: string, label: string, url: string) =>
  `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#18181b">
     <p>${intro}</p>
     <p><a href="${url}" style="display:inline-block;background:#9B7CFF;color:#0B0D12;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px">${label}</a></p>
     <p style="color:#71717a;font-size:13px">Or paste this link into your browser:<br>${url}</p>
   </div>`;

// Invite-only gate. SIGNUP_ALLOWLIST = comma-separated exact emails and/or `@domain`
// entries (e.g. "me@studioapp.co,@studioapp.co,partner@acme.com"). Unset/empty => open
// (local dev) — so prod MUST set it to stay locked down. Sign-IN is never gated; this
// only restricts who can create a new account.
function signupAllowed(email: string): boolean {
  const raw = process.env.SIGNUP_ALLOWLIST?.trim();
  if (!raw) return true;
  const list = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const e = email.trim().toLowerCase();
  const domain = e.includes("@") ? "@" + e.split("@")[1] : "";
  return list.includes(e) || (domain !== "" && list.includes(domain));
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    // Off until the bismite.dev sender domain is verified + delivery is confirmed —
    // flip to true for public launch so unverified emails can't reach the dashboard.
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Reset your Bismite password",
        emailHtml("Forgot your password? Set a new one:", "Reset password", url),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Verify your Bismite email",
        emailHtml("Confirm your email to finish setting up Bismite:", "Verify email", url),
      );
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!signupAllowed(user.email)) {
            throw new APIError("FORBIDDEN", { message: "This email isn’t on the invite list yet." });
          }
          return { data: user };
        },
      },
    },
  },
});
