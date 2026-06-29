// Server-side session gate. requireUser() is the one authz call every dashboard page
// makes before touching the counter — no session => bounce to /signin.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { member } from "../auth-schema";

export async function requireUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/signin");
  return s.user;
}

// Like requireUser, but also resolves the org every "this org's projects" query scopes
// to. Prefers the session's active org; falls back to the user's first membership for
// sessions minted before org assignment (PRD-v2a migration window). Every user has a
// personal org, so a missing org here means a broken account => bounce to signin.
export async function requireOrg() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/signin");
  let orgId = (s.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
  if (!orgId) {
    const [m] = await db
      .select({ orgId: member.organizationId })
      .from(member)
      .where(eq(member.userId, s.user.id))
      .limit(1);
    orgId = m?.orgId ?? null;
  }
  if (!orgId) redirect("/signin");
  return { user: s.user, orgId };
}

// Inverse gate for the auth pages (sign in / sign up / reset password): an already
// signed-in user has no business there, so send them to the dashboard.
export async function requireNoUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (s) redirect("/dashboard");
}
