"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Role = "owner" | "admin" | "member";
type Member = { id: string; role: string; userId: string; name: string; email: string };
type Invite = { id: string; email: string; role: string };

const ROLES: Role[] = ["owner", "admin", "member"];

// Member management. Mutations go straight through the better-auth client — it enforces
// permissions server-side, so we just reflect the result and surface its errors. The UI
// also hides controls a member can't use, so they never see a button that would 403.
export function MembersUI({
  members,
  invitations,
  myUserId,
  myRole,
}: {
  members: Member[];
  invitations: Invite[];
  myUserId: string;
  myRole: Role | null;
}) {
  const router = useRouter();
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);

  // Run a client mutation, toast its error, refresh server data on success.
  async function run(fn: () => Promise<{ error?: { message?: string } | null }>, ok: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.error) return toast.error(res.error.message ?? "Something went wrong");
    toast.success(ok);
    router.refresh();
  }

  return (
    <div className="mt-8 grid gap-8">
      {canManage && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => authClient.organization.inviteMember({ email, role: inviteRole }), "Invitation sent").then(
              () => setEmail(""),
            );
          }}
        >
          <label className="grid flex-1 gap-1.5 text-[13px] text-muted-foreground">
            Invite by email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              required
            />
          </label>
          <select
            aria-label="Invite role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          >
            {/* Only an owner can grant ownership. */}
            {ROLES.filter((r) => r !== "owner" || isOwner).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={busy}>
            <UserPlus /> Invite
          </Button>
        </form>
      )}

      <section className="grid gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Members</h2>
        <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {m.name || m.email} {m.userId === myUserId && <span className="text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {canManage && m.userId !== myUserId ? (
                  <select
                    aria-label={`Role for ${m.email}`}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) =>
                      run(
                        () => authClient.organization.updateMemberRole({ memberId: m.id, role: e.target.value as Role }),
                        "Role updated",
                      )
                    }
                    className="h-8 rounded-md border border-border bg-card px-2 text-xs"
                  >
                    {/* Granting/keeping owner is owner-only. */}
                    {ROLES.filter((r) => r !== "owner" || isOwner || m.role === "owner").map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="neutral">{m.role}</Badge>
                )}
                {canManage && m.userId !== myUserId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${m.email}`}
                    disabled={busy}
                    onClick={() =>
                      run(() => authClient.organization.removeMember({ memberIdOrEmail: m.id }), "Member removed")
                    }
                  >
                    <X />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {invitations.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Pending invitations</h2>
          <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <p className="truncate text-sm">{i.email}</p>
                <Badge variant="neutral">{i.role}</Badge>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={busy}
                    onClick={() =>
                      run(() => authClient.organization.cancelInvitation({ invitationId: i.id }), "Invitation canceled")
                    }
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
