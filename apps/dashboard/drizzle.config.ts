import type { Config } from "drizzle-kit";

// Just the better-auth tables — the counter owns + migrates projects/api_keys separately.
// Used only by `pnpm db:generate` to emit the CREATE SQL; `pnpm db:setup` then applies it
// additively. Do NOT `drizzle-kit push` here — it'd see the counter's tables as foreign.
export default {
  schema: "./auth-schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
