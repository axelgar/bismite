// One-shot, additive setup for the better-auth tables. Applies the committed
// drizzle/*.sql as individual statements — so it ONLY ever creates the auth tables and
// never diffs against the live DB (the counter's projects/api_keys live in the same
// Postgres, and `drizzle-kit push` would offer to drop them). Idempotent: re-running
// skips objects that already exist.
//
// Run: node --env-file=.env.local scripts/setup-db.mjs   (or `pnpm db:setup`)
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { readFileSync, readdirSync } from "node:fs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required (see .env.example)");
const db = drizzle(neon(process.env.DATABASE_URL));

const dir = new URL("../drizzle/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

for (const f of files) {
  const stmts = readFileSync(new URL(f, dir), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim().replace(/;$/, ""))
    .filter(Boolean);
  for (const s of stmts) {
    try {
      await db.execute(sql.raw(s));
      console.log("ok  :", s.split("\n")[0].slice(0, 60));
    } catch (e) {
      if (/already exists|duplicate/i.test(String(e.message))) {
        console.log("skip:", s.split("\n")[0].slice(0, 60), "(exists)");
      } else throw e;
    }
  }
}
console.log("auth tables ready");
