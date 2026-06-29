import "server-only";
import Stripe from "stripe";

// One server-side Stripe client (#6). Billing is "buy, don't build" (PRD §9): Stripe hosts
// Checkout (upgrade) and the Customer Portal (card/cancel), so we only create sessions and
// verify the webhook here. Keys are env-only and never reach the client.
//
// Unset in local dev => billing is OFF: the upgrade button is disabled and the actions throw
// a clear error rather than half-creating a session. `billingEnabled` gates the UI on this.
const KEY = process.env.STRIPE_SECRET_KEY;
export const PRICE_PRO = process.env.STRIPE_PRICE_PRO;
export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
export const billingEnabled = Boolean(KEY && PRICE_PRO);

// Pin nothing — let the SDK use the account's default API version. Lazy: instantiate even
// without a key so imports don't crash; the actions check `billingEnabled` before any call.
export const stripe = new Stripe(KEY ?? "sk_missing");
