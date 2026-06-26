// Tier definitions (PRD-hosted-platform §8) — for DISPLAY only. The counter
// (services/counter/src/plans.ts) is the source of truth that enforces these; this is a
// small mirror so the usage view can show the project's limits without an extra round
// trip. ponytail: two 6-line copies beat a shared package across separate deploys — keep
// the numbers in sync when validation changes them.
export type PlanId = "free" | "pro" | "enterprise";
export interface Plan {
  id: PlanId;
  name: string;
  mtu: number; // Infinity = uncapped (renders as ∞)
  calls: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", name: "Free", mtu: 1_000, calls: 100_000 },
  pro: { id: "pro", name: "Pro", mtu: 100_000, calls: 5_000_000 },
  enterprise: { id: "enterprise", name: "Enterprise", mtu: Infinity, calls: Infinity },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const planFor = (id?: string | null): Plan => PLANS[id as PlanId] ?? PLANS.free;
