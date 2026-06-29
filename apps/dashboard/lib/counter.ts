import "server-only";
// BFF over the counter control-plane API. The dashboard is the per-user authz boundary:
// it holds ADMIN_TOKEN and ALWAYS scopes calls to the logged-in user's `owner` id. The
// counter only added read endpoints for us (list-by-owner, usage-by-projectId); issuance
// stays admin-guarded, and ADMIN_TOKEN never leaves the server.

const BASE = process.env.BISMITE_API_URL ?? "http://localhost:4000";
const ADMIN = process.env.ADMIN_TOKEN;

import type { PlanId } from "./plans";

export type Mode = "test" | "live";
export interface ProjectView {
  projectId: string;
  name: string;
  plan: PlanId;
  stripeCustomerId: string | null;
  createdAt: string;
  keys: Array<{ mode: Mode; createdAt: string; lastUsedAt: string | null }>;
}
export interface UsageSummary {
  mtu: number;
  calls: number;
  period: string;
}

const headers = (): Record<string, string> => (ADMIN ? { authorization: `Bearer ${ADMIN}` } : {});

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`counter ${init?.method ?? "GET"} ${path} -> ${r.status}`);
  return (await r.json()) as T;
}

export function listProjects(owner: string) {
  return call<ProjectView[]>(`/v1/projects?owner=${encodeURIComponent(owner)}`);
}

export function createProject(name: string, owner: string) {
  return call<{ projectId: string; test: string; live: string }>(`/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, owner }),
  });
}

export function regenerate(projectId: string, mode: Mode) {
  return call<{ key: string }>(`/v1/keys/regenerate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId, mode }),
  });
}

export function setPlan(projectId: string, plan: PlanId) {
  return call<{ projectId: string; plan: PlanId }>(`/v1/projects/plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId, plan }),
  });
}

/** Stripe-authoritative tier flip (#6) — called only from the verified webhook, which
 *  is the single writer of paid plans. `setPlan` stays the manual admin/seed lever. */
export function setBilling(projectId: string, plan: PlanId, stripeCustomerId?: string) {
  return call<{ projectId: string; plan: PlanId }>(`/v1/projects/billing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId, plan, stripeCustomerId }),
  });
}

export function usageSummary(projectId: string) {
  return call<UsageSummary>(`/v1/usage/summary?projectId=${encodeURIComponent(projectId)}`);
}

/** Ownership check — every mutation/read for a specific projectId goes through this so a
 *  user can never touch a project they don't own (regenerate takes only a projectId). */
export async function ownedProject(owner: string, projectId: string): Promise<ProjectView | null> {
  const mine = await listProjects(owner);
  return mine.find((p) => p.projectId === projectId) ?? null;
}
