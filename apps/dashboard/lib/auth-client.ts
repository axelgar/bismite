"use client";
// better-auth browser client. Same-origin, so baseURL is inferred — no config needed.
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({ plugins: [organizationClient()] });
