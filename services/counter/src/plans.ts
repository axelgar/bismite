// Tier definitions (PRD-hosted-platform §8, v2/B pricing) — config-as-code, the source
// of truth the counter enforces. MTU is the SOLE billed meter: `mtuIncluded` is free,
// usage above it bills `mtuOveragePer1k` €/1,000 on paid tiers (#8 Stripe Meters).
// `callsCeiling` is a hard fair-use guardrail — never billed, hard-blocked when exceeded
// (#6). Enterprise is uncapped (custom-billed). The dashboard mirrors this for display.
export type PlanId = "free" | "pro" | "enterprise";
export interface Plan {
  id: PlanId;
  name: string;
  mtuIncluded: number; // included Monthly Tracked Users; Infinity = uncapped
  mtuOveragePer1k?: number; // €/1,000 MTU over included; PAID tiers only (omitted = no overage)
  callsCeiling: number; // hard fair-use ceiling on billable calls; Infinity = uncapped
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", name: "Free", mtuIncluded: 1_000, callsCeiling: 100_000 },
  pro: { id: "pro", name: "Pro", mtuIncluded: 10_000, mtuOveragePer1k: 8, callsCeiling: 5_000_000 },
  enterprise: { id: "enterprise", name: "Enterprise", mtuIncluded: Infinity, callsCeiling: Infinity },
};

/** Resolve a stored plan id to its tier; unknown/missing => Free (safe default). */
export const planFor = (id?: string | null): Plan => PLANS[id as PlanId] ?? PLANS.free;
