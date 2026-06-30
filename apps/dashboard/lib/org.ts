import "server-only";
// Org-level Stripe linkage (PRD-v2a #3). The Stripe customer belongs to the org, not the
// project — so the org table (a better-auth table the dashboard owns) is the single home
// for it. Read on checkout/portal; written by the verified webhook on first checkout.
import { eq } from "drizzle-orm";
import { db } from "./db";
import { organization } from "../auth-schema";

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
