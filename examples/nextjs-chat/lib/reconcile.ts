import { stripe } from "./stripe";
import { customerForUser, setPlan } from "./plan-store";
import { planForSubscription } from "../bismite.config";

// Reconciliation: re-pull the user's current plan from Stripe on demand.
// Recovers from a missed webhook — the exact failure mode (Stripe says Pro,
// our state says Free, paying user locked out) this product exists to prevent.
export async function reconcile(userId: string): Promise<void> {
  if (!stripe) return;
  const customerId = customerForUser(userId);
  if (!customerId) {
    setPlan(userId, "free");
    return;
  }
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
  const sub = subs.data[0];
  setPlan(userId, sub ? planForSubscription(sub.status, sub.items.data[0]?.price.id) : "free");
}
