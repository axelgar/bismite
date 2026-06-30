// One-time data migration (PRD-v2a #2): re-home every existing project from its legacy
// `owner` (a user id, now sitting in the renamed `org_id` column after migration 0004)
// into an auto-created personal org owned by that user.
//
// Idempotent by construction: every step skips projects whose org_id already points at a
// real organization, so a project is processed exactly once no matter how often you run
// this. neon-http has no transactions, so each statement stands alone (additive upserts).
//
// Order matters — orgs, then memberships (both filter on org_id still == the user id),
// then the project re-point. Run AFTER the dashboard org tables exist (pnpm db:setup) and
// AFTER counter migration 0004 (pnpm --filter @bismite/counter db:migrate).
//
// Run: node --env-file=.env.local services/counter/scripts/backfill-orgs.mjs
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const db = drizzle(neon(process.env.DATABASE_URL));

// Deterministic ids derived from the user id => re-running upserts the same rows.
// `’s Org` uses U+2019 (not a SQL quote), matching the signup hook's naming; no escaping.
// Guard every step on EXISTS user: a project whose legacy owner has no user row stays
// UN-migrated (org_id untouched) rather than getting a member-less orphan org. It then
// trips the hard "not all migrated" throw below — fail loud, don't silently strand it.
const createOrgs = sql`
  INSERT INTO organization (id, name, slug, created_at)
  SELECT DISTINCT 'org_personal_' || p.org_id,
                  u.name || '’s Org',
                  'personal-' || p.org_id,
                  now()
  FROM projects p
  JOIN "user" u ON u.id = p.org_id
  WHERE p.org_id <> '' AND p.org_id NOT IN (SELECT id FROM organization)
  ON CONFLICT (id) DO NOTHING`;

const createMembers = sql`
  INSERT INTO member (id, organization_id, user_id, role, created_at)
  SELECT DISTINCT 'mem_personal_' || p.org_id, 'org_personal_' || p.org_id, p.org_id, 'owner', now()
  FROM projects p
  WHERE p.org_id <> '' AND p.org_id NOT IN (SELECT id FROM organization)
    AND EXISTS (SELECT 1 FROM "user" u WHERE u.id = p.org_id)
  ON CONFLICT (id) DO NOTHING`;

const repointProjects = sql`
  UPDATE projects p SET org_id = 'org_personal_' || p.org_id
  WHERE p.org_id <> '' AND p.org_id NOT IN (SELECT id FROM organization)
    AND EXISTS (SELECT 1 FROM "user" u WHERE u.id = p.org_id)`;

// --- run, in order ---
await db.execute(createOrgs);
await db.execute(createMembers);
await db.execute(repointProjects);

// --- verify: every non-empty project now points at a real org. A project whose legacy
// owner has no user row is left un-migrated by the EXISTS-guarded steps above, so it shows
// up as projects > migrated and HARD-FAILS below (loud, not a silent member-less orphan). ---
const [counts] = await db.execute(sql`
  SELECT
    (SELECT count(*) FROM projects WHERE org_id <> '') AS projects,
    (SELECT count(*) FROM projects p WHERE p.org_id <> ''
       AND p.org_id IN (SELECT id FROM organization)) AS migrated,
    (SELECT count(*) FROM organization WHERE id LIKE 'org_personal_%') AS personal_orgs,
    (SELECT count(*) FROM member WHERE id LIKE 'mem_personal_%') AS owner_members,
    (SELECT count(*) FROM organization o WHERE o.id LIKE 'org_personal_%'
       AND NOT EXISTS (SELECT 1 FROM member m WHERE m.organization_id = o.id)) AS orphan_orgs`).then(
  (r) => r.rows ?? r,
);

console.log("backfill complete:", counts);
if (Number(counts.projects) !== Number(counts.migrated)) {
  throw new Error(
    `NOT all projects migrated: ${counts.migrated}/${counts.projects} — some project's legacy ` +
      `owner has no user row. Resolve those owners (or delete the dead projects) and re-run.`,
  );
}
// Belt-and-suspenders: with the EXISTS guards this should always be 0; fail if it ever isn't.
if (Number(counts.orphan_orgs) > 0) {
  throw new Error(`${counts.orphan_orgs} org(s) have no owner member — investigate before continuing.`);
}
