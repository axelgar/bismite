// better-auth server instance — buy auth, don't build it (PRD §9). Email+password for v1.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db } from "./db";

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
  emailAndPassword: { enabled: true },
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
  // Verify later: when you open signup beyond the allowlist, wire an email provider and
  // enable verification — no schema change, the `verification` table already exists:
  //   emailAndPassword: { enabled: true, requireEmailVerification: true },
  //   emailVerification: {
  //     sendOnSignUp: true,
  //     sendVerificationEmail: async ({ user, url }) => { /* await resend.emails.send(...) */ },
  //   },
});
