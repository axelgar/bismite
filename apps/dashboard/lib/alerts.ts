import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { usageAlerts } from "../app-schema";

// The pure decision lives in ./threshold (unit-tested); re-exported so callers have one
// import site for the alert logic.
export { thresholdToAlert, THRESHOLDS } from "./threshold";

/** Highest threshold already emailed to this org this period (0 if none). */
export async function lastAlertedThreshold(orgId: string, period: string): Promise<number> {
  const [row] = await db
    .select({ threshold: usageAlerts.threshold })
    .from(usageAlerts)
    .where(and(eq(usageAlerts.orgId, orgId), eq(usageAlerts.period, period)))
    .limit(1);
  return row?.threshold ?? 0;
}

/** Bank the threshold just emailed. Idempotent upsert on (org, period); only ever raises
 *  the recorded threshold, so a redelivered/again-run cron can't lower it. */
export async function recordAlertThreshold(orgId: string, period: string, threshold: number): Promise<void> {
  await db
    .insert(usageAlerts)
    .values({ orgId, period, threshold })
    .onConflictDoUpdate({
      target: [usageAlerts.orgId, usageAlerts.period],
      set: { threshold },
    });
}
