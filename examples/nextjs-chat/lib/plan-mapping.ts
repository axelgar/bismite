import type { Plan } from "bismite"; // type-only: erased at runtime, no resolution

// Plans as code — the dashboard is a later skin. This file IS the control plane.
export const plans = {
  free: { features: { "chat-message": { limit: 5, period: "day" } } },
  pro: { features: { "chat-message": "unlimited" } },
} satisfies Record<string, Plan>;

// Stripe TEST price ID -> plan. Set STRIPE_PRICE_PRO in .env (issue #2/#3).
export const priceToPlan: Record<string, keyof typeof plans> = {
  [process.env.STRIPE_PRICE_PRO ?? "price_pro_unset"]: "pro",
};

export function planForPrice(priceId: string | undefined): keyof typeof plans {
  return (priceId && priceToPlan[priceId]) || "free";
}

/** Pure decision: a Stripe subscription's (status, price) -> our plan.
 *  Cancelled/past_due/etc. fall back to free. No Stripe import, so it's
 *  unit-testable in isolation. */
export function planForSubscription(status: string, priceId: string | undefined): keyof typeof plans {
  const active = status === "active" || status === "trialing";
  return active ? planForPrice(priceId) : "free";
}
