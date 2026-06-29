import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireOrg } from "@/lib/session";
import { ownedProject, usageSummary, usageHistory } from "@/lib/counter";
import { planFor } from "@/lib/plans";
import { billingEnabled } from "@/lib/stripe";
import { TopBar } from "@/components/top-bar";
import { SignOut } from "../sign-out";
import { ProjectTabs } from "./project-tabs";

export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { projectId } = await params;
  const { upgraded } = await searchParams;
  const { user, orgId } = await requireOrg();
  const project = await ownedProject(orgId, projectId);
  if (!project) notFound();
  const usage = await usageSummary(projectId);
  // Charts are non-critical: a snapshot-history blip must not 500 the project page.
  const history = await usageHistory(projectId).catch(() => []);
  const plan = planFor(project.plan);

  return (
    <>
      <TopBar>
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{user.email}</span>
        <SignOut />
      </TopBar>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Projects
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{project.name || projectId}</h1>
        <p className="mt-1.5 font-mono text-xs text-muted-foreground">{projectId}</p>

        <ProjectTabs
          projectId={projectId}
          period={usage.period}
          mtu={usage.mtu}
          calls={usage.calls}
          history={history}
          mtuLimit={plan.mtuIncluded}
          callsLimit={plan.callsCeiling}
          planId={plan.id}
          planName={plan.name}
          keys={project.keys.map((k) => ({ mode: k.mode, lastUsedAt: k.lastUsedAt }))}
          billingEnabled={billingEnabled}
          hasCustomer={Boolean(project.stripeCustomerId)}
          upgraded={upgraded === "1"}
        />
      </main>
    </>
  );
}
