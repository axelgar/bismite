// Control-plane schema (PRD-hosted-platform §6, §7). Source of truth for keys;
// the counter's hot path caches key->project off this. Two small tables — no ORM
// relations machinery needed, Drizzle gives us typed queries + migration history.
import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // proj_<hex>
  name: text("name").notNull().default(""),
  owner: text("owner").notNull().default(""),
  // Billing tier (PRD §8). Flipped by the Stripe webhook (#6) via setBilling; the
  // /v1/projects/plan admin lever still works for seeds and negotiated Enterprise deals.
  // Limits live in code (src/plans.ts), so this is just the tier id — easy to change.
  plan: text("plan").notNull().default("free"),
  // Stripe customer id (#6), set on first checkout. Lets the dashboard open the Customer
  // Portal (card/cancel) for a returning paid user. Null until they buy something.
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(), // key_<hex>
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // SHA-256 hex of the full secret. Keys are high-entropy random tokens, so a fast
    // hash is correct here (not bcrypt — these aren't low-entropy passwords) and keeps
    // the resolve lookup cheap. Plaintext is shown once at issuance and never stored.
    hashedKey: text("hashed_key").notNull().unique(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  // One active key per project per mode — regenerate replaces it (PRD §7:
  // regenerate-to-rotate; multi-active-key rotation is deferred).
  (t) => [unique("api_keys_project_mode").on(t.projectId, t.mode)],
);
