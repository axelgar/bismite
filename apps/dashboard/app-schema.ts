// App-owned tables (not better-auth's generated auth-schema). Kept separate so
// `pnpm auth:generate` never clobbers them; both files are in drizzle.config.
import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

// Threshold-alert de-dupe (observability PRD-C #7). One row per org per billing
// period holds the highest MTU threshold (80 | 100) already emailed, so the daily
// alert cron sends each threshold at most once a period. New period => no row =>
// alerts fire fresh.
export const usageAlerts = pgTable(
  "usage_alerts",
  {
    orgId: text("org_id").notNull(),
    period: text("period").notNull(), // counter's billing period, e.g. "2026-06"
    threshold: integer("threshold").notNull(), // highest pct emailed this period
    alertedAt: timestamp("alerted_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.period] })],
);
