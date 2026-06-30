import "server-only";
import Stripe from "stripe";

// One server-side Stripe client (#6). Billing is "buy, don't build" (PRD §9): Stripe hosts
// Checkout (upgrade) and the Customer Portal (card/cancel), so we only create sessions and
// verify the webhook here. Keys are env-only and never reach the client.
//
// Unset in local dev => billing is OFF: the upgrade button is disabled and the actions throw
// a clear error rather than half-creating a session. `billingEnabled` gates the UI on this.
const KEY = process.env.STRIPE_SECRET_KEY;
export const PRICE_PRO = process.env.STRIPE_PRICE_PRO; // €19/mo flat base — the per-org subscription
// Metered price for MTU overage (€8 / 1,000 MTU above included), linked to the Stripe Meter
// below. Optional: unset => no overage line is added and the reconcile job no-ops, so a flat
// Pro tier still works in dev. Create the meter + metered price in the Stripe console (test+live).
export const PRICE_MTU_OVERAGE = process.env.STRIPE_PRICE_MTU_OVERAGE;
// The Meter's event_name — what the reconcile job reports org MTU overage against.
export const METER_EVENT_MTU_OVERAGE = process.env.STRIPE_METER_MTU_OVERAGE ?? "mtu_overage";
export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
export const billingEnabled = Boolean(KEY && PRICE_PRO);
// Overage billing only activates when the metered price is also configured.
export const overageEnabled = Boolean(KEY && PRICE_MTU_OVERAGE);

// Pin nothing — let the SDK use the account's default API version. Lazy: instantiate even
// without a key so imports don't crash; the actions check `billingEnabled` before any call.
export const stripe = new Stripe(KEY ?? "sk_missing");
