import "server-only";
// Org-level Stripe linkage (PRD-v2a #3). The Stripe customer belongs to the org, not the
// project — so the org table (a better-auth table the dashboard owns) is the single home
// for it. Read on checkout/portal; written by the verified webhook on first checkout.
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { organization, member, user } from "../auth-schema";

export async function getOrgCustomerId(orgId: string): Promise<string | null> {
  const [o] = await db
    .select({ customerId: organization.stripeCustomerId })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  return o?.customerId ?? null;
}

/** Persist the org's Stripe customer the first time a checkout creates one. Idempotent —
 *  the webhook may redeliver, and the customer id never changes once set. */
export async function setOrgCustomerId(orgId: string, customerId: string): Promise<void> {
  await db.update(organization).set({ stripeCustomerId: customerId }).where(eq(organization.id, orgId));
}

/** Every org that has ever subscribed (has a Stripe customer) — the overage reconcile's
 *  work-list. Canceled orgs are harmless to include: with no metered price on an inactive
 *  subscription, their meter events simply aren't invoiced. */
export async function listOrgsWithCustomer(): Promise<Array<{ id: string; stripeCustomerId: string }>> {
  const rows = await db
    .select({ id: organization.id, stripeCustomerId: organization.stripeCustomerId })
    .from(organization)
    .where(isNotNull(organization.stripeCustomerId));
  return rows.filter((r): r is { id: string; stripeCustomerId: string } => !!r.stripeCustomerId);
}

/** Every org — the threshold-alert cron's work-list (Free orgs included; they're the
 *  conversion lever). `hasCustomer` lets the cron treat ever-subscribed orgs as the Pro
 *  ceiling without a counter round-trip. */
export async function listAllOrgs(): Promise<Array<{ id: string; hasCustomer: boolean }>> {
  const rows = await db
    .select({ id: organization.id, customerId: organization.stripeCustomerId })
    .from(organization);
  return rows.map((r) => ({ id: r.id, hasCustomer: !!r.customerId }));
}

/** Owner/admin emails for an org — who threshold + billing alerts go to (PRD-v2a roles). */
export async function orgAdminEmails(orgId: string): Promise<string[]> {
  const rows = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.organizationId, orgId), inArray(member.role, ["owner", "admin"])));
  return rows.map((r) => r.email);
}
