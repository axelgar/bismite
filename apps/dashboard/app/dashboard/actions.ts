"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import * as counter from "@/lib/counter";
import { stripe, billingEnabled, PRICE_PRO } from "@/lib/stripe";

const APP_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";

// Secrets cross back to the client exactly once, as the return value of these actions —
// never persisted, never re-fetchable (the counter only stores hashes).

export async function createProjectAction(name: string) {
  const user = await requireUser();
  const clean = name.trim();
  if (!clean) return { error: "Name is required" as const };
  const out = await counter.createProject(clean, user.id);
  revalidatePath("/dashboard");
  return { projectId: out.projectId, test: out.test, live: out.live };
}

export async function regenerateAction(projectId: string, mode: counter.Mode) {
  const user = await requireUser();
  // Ownership gate: regenerate takes only a projectId, so confirm it's the user's first.
  if (!(await counter.ownedProject(user.id, projectId))) return { error: "Not found" as const };
  const { key } = await counter.regenerate(projectId, mode);
  revalidatePath(`/dashboard/${projectId}`);
  return { mode, key };
}

// #6: upgrades are gated behind Stripe Checkout — the plan is flipped ONLY by the verified
// webhook (app/api/stripe/webhook), never by a user action. Downgrades happen via the
// Customer Portal (cancel) so the subscription actually stops billing. There is no
// free self-serve setPlan anymore; counter.setPlan stays an admin/seed lever only.

export async function checkoutAction(projectId: string) {
  const user = await requireUser();
  const project = await counter.ownedProject(user.id, projectId);
  if (!project) return { error: "Not found" as const };
  if (!billingEnabled) return { error: "Billing is not configured" as const };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: PRICE_PRO, quantity: 1 }],
    // Reuse the project's customer if it has one (resubscribe), else let Stripe create one
    // keyed to the signed-in email. projectId rides on both the session and the subscription
    // so every lifecycle event maps back to exactly one project in the webhook.
    ...(project.stripeCustomerId ? { customer: project.stripeCustomerId } : { customer_email: user.email }),
    client_reference_id: projectId,
    metadata: { projectId },
    subscription_data: { metadata: { projectId } },
    success_url: `${APP_URL}/dashboard/${projectId}?upgraded=1`,
    cancel_url: `${APP_URL}/dashboard/${projectId}`,
  });
  if (!session.url) return { error: "Could not start checkout" as const };
  redirect(session.url);
}

export async function portalAction(projectId: string) {
  const user = await requireUser();
  const project = await counter.ownedProject(user.id, projectId);
  if (!project) return { error: "Not found" as const };
  if (!project.stripeCustomerId) return { error: "No billing account yet" as const };

  const session = await stripe.billingPortal.sessions.create({
    customer: project.stripeCustomerId,
    return_url: `${APP_URL}/dashboard/${projectId}`,
  });
  redirect(session.url);
}
