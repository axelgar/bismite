"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import * as counter from "@/lib/counter";
import type { PlanId } from "@/lib/plans";

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

export async function setPlanAction(projectId: string, plan: PlanId) {
  const user = await requireUser();
  // Ownership gate — setPlan takes only a projectId, so confirm it's the user's first.
  if (!(await counter.ownedProject(user.id, projectId))) return { error: "Not found" as const };
  // TODO(#6): this is a FREE self-upgrade — any user can pick "enterprise" with no payment.
  // It's the pre-Stripe manual lever and is only safe while signup is invite-only. Before
  // opening signup, #6 must gate upgrades behind Stripe Checkout (downgrades can stay free).
  // See BACKLOG.md.
  await counter.setPlan(projectId, plan);
  revalidatePath(`/dashboard/${projectId}`);
  return { ok: true as const };
}
