import Stripe from "stripe";

// Null when unconfigured so `next build` and the no-Stripe demo still work.
// Routes guard on this and return 500 if Stripe isn't set up.
const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key ? new Stripe(key) : null;
