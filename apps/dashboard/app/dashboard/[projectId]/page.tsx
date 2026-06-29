import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { ownedProject, usageSummary, type Mode } from "@/lib/counter";
import { planFor } from "@/lib/plans";
import { billingEnabled } from "@/lib/stripe";
import { Regenerate } from "./regenerate";
import { PlanSelect } from "./plan-select";

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div style={{ margin: "12px 0" }}>
      <div className="row">
        <strong>{label}</strong>
        <span className="muted">
          {used.toLocaleString()} / {limit.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="bar">
        <span style={{ width: `${pct}%`, background: pct >= 100 ? "#dc2626" : undefined }} />
      </div>
    </div>
  );
}

const MODES: Mode[] = ["test", "live"];

export default async function ProjectDetail({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await ownedProject(user.id, projectId);
  if (!project) notFound();
  const usage = await usageSummary(projectId);
  const plan = planFor(project.plan);

  const keyByMode = new Map(project.keys.map((k) => [k.mode, k]));

  return (
    <main>
      <p>
        <Link href="/dashboard">← Projects</Link>
      </p>
      <h1>{project.name || projectId}</h1>
      <p className="muted">{projectId}</p>

      <h2>Usage · {usage.period}</h2>
      <div className="card">
        <PlanSelect projectId={projectId} plan={plan.id} billingEnabled={billingEnabled} />
        <Meter label="Monthly Tracked Users" used={usage.mtu} limit={plan.mtu} />
        <Meter label="Calls" used={usage.calls} limit={plan.calls} />
        <p className="muted">
          Live-mode only · {plan.name} plan · MTU is the headline limit (over it shows
          “upgrade”); calls are a guardrail. Test traffic isn’t metered.
        </p>
      </div>

      <h2>API keys</h2>
      {MODES.map((mode) => {
        const k = keyByMode.get(mode);
        return (
          <div className="card" key={mode}>
            <div className="row">
              <div>
                <strong>{mode}</strong>{" "}
                <code className="key">bsk_{mode}_••••••••</code>
                <div className="muted">
                  {k?.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString()}` : "never used"}
                </div>
              </div>
              <Regenerate projectId={projectId} mode={mode} />
            </div>
          </div>
        );
      })}

      <h2>Quickstart</h2>
      <pre>{`# .env
BISMITE_API_KEY=<your live key>`}</pre>
      <pre>{`import { bismiteCounter } from "bismite/hosted";

counter: bismiteCounter(process.env.BISMITE_API_KEY!)`}</pre>
      <p className="muted">Keys are shown once. Lost it? Regenerate above.</p>
    </main>
  );
}
