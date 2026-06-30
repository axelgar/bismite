import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/top-bar";
import { SignOut } from "../sign-out";
import { AccountUI } from "./account-ui";

// Account settings: profile, change-password-while-signed-in (closes the gap the reset
// page promised), and active sessions. All better-auth — we just present it.
export default async function AccountPage() {
  const user = await requireUser();
  const h = await headers();
  const current = await auth.api.getSession({ headers: h });
  const sessions = await auth.api.listSessions({ headers: h }).catch(() => []);

  const rows = sessions.map((s) => ({
    token: s.token,
    current: s.token === current?.session.token,
    ipAddress: s.ipAddress ?? null,
    userAgent: s.userAgent ?? null,
    createdAt: (s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt)).toISOString(),
  }));

  return (
    <>
      <TopBar>
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{user.email}</span>
        <SignOut />
      </TopBar>
      <main className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <AccountUI name={user.name} email={user.email} sessions={rows} />
      </main>
    </>
  );
}
