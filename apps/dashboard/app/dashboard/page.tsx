import Link from "next/link";
import { ChevronRight, FolderPlus, KeyRound } from "lucide-react";
import { requireOrg, canManageKeys } from "@/lib/session";
import { listProjects, orgUsage } from "@/lib/counter";
import { planFor } from "@/lib/plans";
import { TopBar } from "@/components/top-bar";
import { CreateProject } from "./create-project";
import { SignOut } from "./sign-out";

export default async function Dashboard() {
  const { user, orgId, role } = await requireOrg();
  const canCreate = canManageKeys(role); // members use keys but don't create projects
  // Degrade gracefully: a counter outage/misconfig shows a banner, not a white-screen 500.
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let orgMtu = 0;
  let loadError = false;
  try {
    const [projs, usage] = await Promise.all([listProjects(orgId), orgUsage(orgId)]);
    projects = projs;
    orgMtu = usage.mtu;
  } catch {
    loadError = true;
  }
  // Plan is per-org (v2/B): every project shares it. Free orgs are capped at one project.
  const plan = planFor(projects[0]?.plan);
  const atFreeLimit = plan.id === "free" && projects.length >= 1;

  return (
    <>
      <TopBar>
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{user.email}</span>
        <SignOut />
      </TopBar>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Each project gets its own test &amp; live API keys.
            </p>
            {!loadError && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {plan.name} · {orgMtu.toLocaleString()} org MTU this period
                {isFinite(plan.mtuIncluded) ? ` / ${plan.mtuIncluded.toLocaleString()} included` : ""}
              </p>
            )}
          </div>
          {projects.length > 0 && canCreate && !atFreeLimit && <CreateProject />}
        </div>

        {loadError && (
          <p
            role="alert"
            className="mt-6 rounded-[12px] border border-[rgba(240,85,106,0.4)] bg-[rgba(240,85,106,0.08)] px-4 py-3 text-[13px] text-destructive"
          >
            Couldn’t reach the counter service. Check it’s up and that this dashboard’s
            ADMIN_TOKEN matches the counter’s.
          </p>
        )}

        {!loadError && projects.length === 0 ? (
          <div className="relative mt-8 overflow-hidden rounded-[16px] border border-border bg-card p-10 text-center shadow-[0_28px_64px_-30px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="halo left-1/2 top-[-60px] h-[280px] w-[420px] -translate-x-1/2" />
            <div className="relative mx-auto flex max-w-sm flex-col items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-[12px] border border-border bg-surface text-accent-tint">
                <FolderPlus className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Create your first project</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  You’ll get a test and a live API key in seconds — drop one into{" "}
                  <code className="font-mono text-foreground-2">BISMITE_API_KEY</code> and you’re metering.
                </p>
              </div>
              {canCreate && <CreateProject />}
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <Link
                key={p.projectId}
                href={`/dashboard/${p.projectId}`}
                className="group flex items-center justify-between gap-3 rounded-[16px] border border-border bg-card p-5 shadow-[0_28px_64px_-30px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-input"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name || p.projectId}</div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{p.projectId}</div>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <KeyRound className="size-3.5" />
                  {p.keys.length}
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}

        {atFreeLimit && canCreate && (
          <p className="mt-4 text-[13px] text-muted-foreground">
            The Free plan includes one project.{" "}
            <Link href={`/dashboard/${projects[0].projectId}`} className="text-foreground-2 underline-offset-2 hover:underline">
              Upgrade to Pro
            </Link>{" "}
            to add more.
          </p>
        )}
      </main>
    </>
  );
}
