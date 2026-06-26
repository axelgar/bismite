"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import * as counter from "@/lib/counter";

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
