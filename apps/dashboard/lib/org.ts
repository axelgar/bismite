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

/** Every org that has a Stripe customer — the overage reconcile's work-list. Having a
 *  customer id only means "could be billed"; the reconcile still gates on the ENFORCED plan
 *  (from the counter) so a canceled org that kept its id isn't billed overage. */
export async function listOrgsWithCustomer(): Promise<Array<{ id: string; stripeCustomerId: string }>> {
  const rows = await db
    .select({ id: organization.id, stripeCustomerId: organization.stripeCustomerId })
    .from(organization)
    .where(isNotNull(organization.stripeCustomerId));
  return rows.filter((r): r is { id: string; stripeCustomerId: string } => !!r.stripeCustomerId);
}

/** Every org id — the threshold-alert cron's work-list (all tiers; the enforced plan is
 *  read per-org from the counter, never inferred from a Stripe-customer proxy). */
export async function listAllOrgIds(): Promise<string[]> {
  const rows = await db.select({ id: organization.id }).from(organization);
  return rows.map((r) => r.id);
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
