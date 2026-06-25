import { defineConfig } from "drizzle-kit";

// drizzle-kit generate -> ./drizzle migrations; db:migrate applies them to Neon.
// Local dev/tests use PGlite and apply these same migration files at startup.
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
