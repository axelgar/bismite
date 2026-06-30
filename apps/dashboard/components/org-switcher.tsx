"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Active-org picker. Reactive off better-auth's client hooks; switching sets the session's
// active org and refreshes so every server component re-scopes to the new org's projects.
// A solo dev (one org) sees their org name as a static label, not a pointless dropdown.
export function OrgSwitcher() {
  const router = useRouter();
  const { data: orgs } = authClient.useListOrganizations();
  const { data: session } = authClient.useSession();
  if (!orgs || orgs.length === 0) return null;

  const active = session?.session?.activeOrganizationId ?? orgs[0]?.id ?? "";

  if (orgs.length === 1) {
    return <span className="text-sm font-medium text-foreground">{orgs[0].name}</span>;
  }

  return (
    <select
      aria-label="Active organization"
      value={active}
      onChange={async (e) => {
        await authClient.organization.setActive({ organizationId: e.target.value });
        router.refresh();
      }}
      className="rounded-md border border-border bg-card px-2 py-1 text-sm font-medium text-foreground"
    >
      {orgs.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
