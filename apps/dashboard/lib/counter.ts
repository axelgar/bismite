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
export interface UsageSnapshot {
  date: string; // YYYY-MM-DD
  mtu: number;
  calls: number;
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

export function listProjects(orgId: string) {
  return call<ProjectView[]>(`/v1/projects?org=${encodeURIComponent(orgId)}`);
}

/** Create a project. Returns secrets, or { error: "free_one_project" } when a Free org is
 *  already at its 1-project limit (v2/B) — surfaced so the action can CTA-upgrade. */
export async function createProject(
  name: string,
  orgId: string,
): Promise<{ projectId: string; test: string; live: string } | { error: "free_one_project" }> {
  const r = await fetch(`${BASE}/v1/projects`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ name, org: orgId }),
  });
  if (r.status === 403) {
    const b = (await r.json().catch(() => ({}))) as { error?: string };
    if (b.error === "free_one_project") return { error: "free_one_project" };
  }
  if (!r.ok) throw new Error(`counter POST /v1/projects -> ${r.status}`);
  return (await r.json()) as { projectId: string; test: string; live: string };
}

export function regenerate(projectId: string, mode: Mode) {
  return call<{ key: string }>(`/v1/keys/regenerate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId, mode }),
  });
}

/** Manual admin/seed lever — set an ORG's tier (v2/B: plan is per-org). */
export function setPlan(orgId: string, plan: PlanId) {
  return call<{ orgId: string; plan: PlanId }>(`/v1/projects/plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orgId, plan }),
  });
}

/** Stripe-authoritative tier flip (v2/B) — called only from the verified webhook, which is
 *  the single writer of paid plans. Keyed off the ORG (per-org subscription). */
export function setBilling(orgId: string, plan: PlanId, stripeCustomerId?: string) {
  return call<{ orgId: string; plan: PlanId }>(`/v1/projects/billing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orgId, plan, stripeCustomerId }),
  });
}

export function usageSummary(projectId: string) {
  return call<UsageSummary>(`/v1/usage/summary?projectId=${encodeURIComponent(projectId)}`);
}

/** Authoritative org MTU this period — distinct users across all the org's projects (v2/B).
 *  Basis for the org usage view and the overage reconcile. */
export function orgUsage(orgId: string) {
  // `plan` is the ENFORCED tier (from the counter) — the crons size limits off it, never a
  // stale "has a Stripe customer" proxy.
  return call<{ mtu: number; period: string; plan: PlanId }>(
    `/v1/usage/org?orgId=${encodeURIComponent(orgId)}`,
  );
}

/** Bank an org's authoritative period overage and get back only the not-yet-reported delta
 *  to push to Stripe (idempotent + missed-run-safe). Used by the overage reconcile. */
export function overageDelta(orgId: string, overage: number) {
  return call<{ delta: number }>(`/v1/usage/org/overage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orgId, overage }),
  });
}

/** Roll back a banked overage delta when the Stripe push fails, so the next reconcile
 *  re-derives and retries it instead of silently dropping the overage. */
export function unbankOverage(orgId: string, delta: number) {
  return call<{ ok: true }>(`/v1/usage/org/overage/unbank`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orgId, delta }),
  });
}

/** Daily snapshot history (oldest first) for the trend charts (observability PRD-C). */
export function usageHistory(projectId: string) {
  return call<UsageSnapshot[]>(`/v1/usage/history?projectId=${encodeURIComponent(projectId)}`);
}

/** Authz check — every mutation/read for a specific projectId goes through this so a
 *  caller can never touch a project outside their active org (regenerate takes only a
 *  projectId). Scoped to the org, not the user: teammates share their org's projects. */
export async function ownedProject(orgId: string, projectId: string): Promise<ProjectView | null> {
  const ours = await listProjects(orgId);
  return ours.find((p) => p.projectId === projectId) ?? null;
}
