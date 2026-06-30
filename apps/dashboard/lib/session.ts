// Server-side session gate. requireUser() is the one authz call every dashboard page
// makes before touching the counter — no session => bounce to /signin.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and, asc } from "drizzle-orm";
import { auth, ensurePersonalOrg } from "./auth";
import { db } from "./db";
import { member } from "../auth-schema";

export type OrgRole = "owner" | "admin" | "member";
// Key/project management is admin+owner; billing is owner-only (PRD-v2a roles). A `member`
// reads usage and uses keys but manages neither.
export const canManageKeys = (role: OrgRole | null) => role === "owner" || role === "admin";
export const canManageBilling = (role: OrgRole | null) => role === "owner";

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
      .orderBy(asc(member.createdAt)) // deterministic: same org each time
      .limit(1);
    orgId = m?.orgId ?? null;
  }
  // Self-heal: a user whose signup org-create failed has no membership — create their
  // personal org now rather than bouncing them to /signin in a permanent loop.
  if (!orgId) orgId = await ensurePersonalOrg(s.user).catch(() => null);
  if (!orgId) redirect("/signin");
  // The user's role in the active org — gates key/billing actions.
  const [mr] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, s.user.id), eq(member.organizationId, orgId)))
    .limit(1);
  return { user: s.user, orgId, role: (mr?.role ?? null) as OrgRole | null };
}

// Inverse gate for the auth pages (sign in / sign up / reset password): an already
// signed-in user has no business there, so send them on — to `dest` (e.g. a pending
// invite the link carried) or the dashboard.
export async function requireNoUser(dest = "/dashboard") {
  const s = await auth.api.getSession({ headers: await headers() });
  if (s) redirect(dest);
}
