// Tier definitions (PRD-hosted-platform §8) — config-as-code, the source of truth the
// counter enforces. MTU is the headline limit (over it => over-limit signal, never a
// block — fail-open holds); calls are an included allowance with overage handled as a
// guardrail (#6), so they're surfaced but never hard-blocked here.
// Numbers are placeholders, easily changed once validation lands (PRD §8/§13:
// "do not anchor low"). Enterprise is uncapped. The dashboard mirrors this for display.
export type PlanId = "free" | "pro" | "enterprise";
export interface Plan {
  id: PlanId;
  name: string;
  mtu: number; // included Monthly Tracked Users; Infinity = uncapped
  calls: number; // included billable calls; Infinity = uncapped
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", name: "Free", mtu: 1_000, calls: 100_000 },
  pro: { id: "pro", name: "Pro", mtu: 100_000, calls: 5_000_000 },
  enterprise: { id: "enterprise", name: "Enterprise", mtu: Infinity, calls: Infinity },
};

/** Resolve a stored plan id to its tier; unknown/missing => Free (safe default). */
export const planFor = (id?: string | null): Plan => PLANS[id as PlanId] ?? PLANS.free;
