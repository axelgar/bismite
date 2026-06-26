"use client";
// better-auth browser client. Same-origin, so baseURL is inferred — no config needed.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
