// Control-plane schema (PRD-hosted-platform §6, §7). Source of truth for keys;
// the counter's hot path caches key->project off this. Two small tables — no ORM
// relations machinery needed, Drizzle gives us typed queries + migration history.
import { pgTable, text, timestamp, unique, integer, date, primaryKey } from "drizzle-orm/pg-core";

// Billing tier is an ORG attribute (v2/B): one Pro subscription per org, so plan + the
// Stripe customer live here, not on the project. A project resolves to its org's plan. Rows
// are created on first project (default free) and upserted by the verified Stripe webhook.
export const orgs = pgTable("orgs", {
  id: text("id").primaryKey(), // better-auth organization id
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // proj_<hex>
  name: text("name").notNull().default(""),
  // Owning org (PRD-v2a). Was `owner` (a user id); a project now belongs to an org, not a
  // person. The counter only stores it for billing attribution — who-can-see-it authz is
  // enforced in the dashboard, which holds the better-auth session.
  orgId: text("org_id").notNull().default(""),
  // Deprecated (v2/B): plan + customer moved to `orgs` (per-org subscription). Kept to avoid
  // a destructive migration on the pre-launch DB; no longer read. Drop in a later cleanup.
  plan: text("plan").notNull().default("free"),
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

// Daily usage snapshot per project (observability PRD-C §4). Redis only holds the
// current period count, so trend has to be persisted here. One row per project per
// UTC day; the composite (project_id, date) PK is the idempotency key the snapshot
// cron upserts on — re-running a day overwrites rather than duplicates.
export const usageSnapshots = pgTable(
  "usage_snapshots",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // YYYY-MM-DD, UTC
    mtu: integer("mtu").notNull().default(0),
    calls: integer("calls").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.date] })],
);
