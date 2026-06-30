// Pure threshold decision for the usage-alert cron (observability PRD-C #7). No
// server-only / db imports, so it's unit-testable in isolation.

// MTU thresholds that trigger an email, low→high.
export const THRESHOLDS = [80, 100] as const;

/** The threshold to email about now, or 0 for none. Returns the HIGHEST crossed
 *  threshold that's above what we've already alerted this period — so a gradual climb
 *  fires 80 then 100 (one each), and a jump straight past 100 fires only 100 (no spam). */
export function thresholdToAlert(used: number, ceiling: number, lastAlerted: number): number {
  if (!isFinite(ceiling) || ceiling <= 0) return 0; // uncapped => never alerts
  const pct = (used / ceiling) * 100;
  let pick = 0;
  for (const t of THRESHOLDS) {
    if (pct >= t && t > lastAlerted) pick = t; // highest qualifying threshold
  }
  return pick;
}
