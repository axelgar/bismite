// Drizzle instance for better-auth's tables (Neon). neon-http is lazy — no connection
// is opened until the first query — so importing this is safe at build/generate time.
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../auth-schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required (better-auth store). See .env.example.");

export const db = drizzle(neon(url), { schema });
