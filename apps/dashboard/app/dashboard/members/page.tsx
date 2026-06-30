import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireOrg } from "@/lib/session";
import { TopBar } from "@/components/top-bar";
import { SignOut } from "../sign-out";
import { MembersUI } from "./members-ui";

// Team management for the active org: who's in, who's invited, and (for admins/owners)
// invite / change-role / remove. Authz is the plugin's; this page only reflects it.
export default async function MembersPage() {
  const { user, orgId, role } = await requireOrg();
  const org = await auth.api.getFullOrganization({
    query: { organizationId: orgId },
    headers: await headers(),
  });

  const members = (org?.members ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    userId: m.userId,
    name: m.user?.name ?? "",
    email: m.user?.email ?? "",
  }));
  const invitations = (org?.invitations ?? [])
    .filter((i) => i.status === "pending")
    .map((i) => ({ id: i.id, email: i.email, role: i.role ?? "member" }));

  return (
    <>
      <TopBar>
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{user.email}</span>
        <SignOut />
      </TopBar>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{org?.name ?? "Team"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Members share this org’s projects. Roles: owner manages billing, admin manages keys &
          members, member uses keys.
        </p>
        <MembersUI members={members} invitations={invitations} myUserId={user.id} myRole={role} />
      </main>
    </>
  );
}
