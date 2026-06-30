"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import * as counter from "@/lib/counter";
import { getOrgCustomerId } from "@/lib/org";
import { stripe, billingEnabled, PRICE_PRO } from "@/lib/stripe";

const APP_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";

// Secrets cross back to the client exactly once, as the return value of these actions —
// never persisted, never re-fetchable (the counter only stores hashes).

export async function createProjectAction(name: string) {
  const { orgId } = await requireOrg();
  const clean = name.trim();
  if (!clean) return { error: "Name is required" as const };
  const out = await counter.createProject(clean, orgId);
  revalidatePath("/dashboard");
  return { projectId: out.projectId, test: out.test, live: out.live };
}

export async function regenerateAction(projectId: string, mode: counter.Mode) {
  const { orgId } = await requireOrg();
  // Authz gate: regenerate takes only a projectId, so confirm it's in the active org first.
  if (!(await counter.ownedProject(orgId, projectId))) return { error: "Not found" as const };
  const { key } = await counter.regenerate(projectId, mode);
  revalidatePath(`/dashboard/${projectId}`);
  return { mode, key };
}

// #6: upgrades are gated behind Stripe Checkout — the plan is flipped ONLY by the verified
// webhook (app/api/stripe/webhook), never by a user action. Downgrades happen via the
// Customer Portal (cancel) so the subscription actually stops billing. There is no
// free self-serve setPlan anymore; counter.setPlan stays an admin/seed lever only.

export async function checkoutAction(projectId: string) {
  const { user, orgId } = await requireOrg();
  const project = await counter.ownedProject(orgId, projectId);
  if (!project) return { error: "Not found" as const };
  if (!billingEnabled) return { error: "Billing is not configured" as const };

  // Customer = the org (#3): reuse the org's customer if it has one (any prior checkout on
  // any of its projects), else let Stripe create one keyed to the signed-in email — the
  // webhook then stores it on the org. orgId attributes the customer; projectId flips the
  // enforced tier. Both ride the session and the subscription so every event maps cleanly.
  const customerId = await getOrgCustomerId(orgId);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: PRICE_PRO, quantity: 1 }],
    ...(customerId ? { customer: customerId } : { customer_email: user.email }),
    client_reference_id: projectId,
    metadata: { orgId, projectId },
    subscription_data: { metadata: { orgId, projectId } },
    success_url: `${APP_URL}/dashboard/${projectId}?upgraded=1`,
    cancel_url: `${APP_URL}/dashboard/${projectId}`,
  });
  if (!session.url) return { error: "Could not start checkout" as const };
  redirect(session.url);
}

export async function portalAction(projectId: string) {
  const { orgId } = await requireOrg();
  // Authz: the project must be in the active org. The portal manages the org's customer.
  if (!(await counter.ownedProject(orgId, projectId))) return { error: "Not found" as const };
  const customerId = await getOrgCustomerId(orgId);
  if (!customerId) return { error: "No billing account yet" as const };

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/dashboard/${projectId}`,
  });
  redirect(session.url);
}
