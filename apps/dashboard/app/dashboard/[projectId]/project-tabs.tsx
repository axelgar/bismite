"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Mode } from "@/lib/counter";
import type { PlanId } from "@/lib/plans";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UsageCard, meterState } from "@/components/meter";
import { Segmented } from "@/components/segmented";
import { CodeBlock } from "@/components/code-block";
import { Regenerate } from "./regenerate";
import { PlanSection, UpgradeButton } from "./plan-select";

interface KeyView {
  mode: Mode;
  lastUsedAt: string | null;
}

export function ProjectTabs({
  projectId,
  period,
  mtu,
  calls,
  mtuLimit,
  callsLimit,
  planId,
  planName,
  keys,
  billingEnabled,
  hasCustomer,
  upgraded,
}: {
  projectId: string;
  period: string;
  mtu: number;
  calls: number;
  mtuLimit: number;
  callsLimit: number;
  planId: PlanId;
  planName: string;
  keys: KeyView[];
  billingEnabled: boolean;
  hasCustomer: boolean;
  upgraded: boolean;
}) {
  const [mode, setMode] = useState<Mode>("live");

  // Returned from Stripe Checkout success.
  useEffect(() => {
    if (upgraded) toast.success("Upgrade complete — your new plan is active.");
  }, [upgraded]);

  const mtuOver = meterState(mtu, mtuLimit) === "over";
  const keyForMode = keys.find((k) => k.mode === mode);

  return (
    <Tabs defaultValue="usage" className="mt-6">
      <TabsList>
        <TabsTrigger value="usage">Usage</TabsTrigger>
        <TabsTrigger value="plan">Plan</TabsTrigger>
        <TabsTrigger value="keys">API keys</TabsTrigger>
        <TabsTrigger value="quickstart">Quickstart</TabsTrigger>
      </TabsList>

      {/* ---- Usage ---- */}
      <TabsContent value="usage">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Usage</h2>
            <p className="mt-1.5 font-mono text-[12.5px] text-muted-foreground">{period} · live mode</p>
          </div>
          <Badge>{planName} plan</Badge>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <UsageCard label="Monthly Tracked Users" used={mtu} limit={mtuLimit}>
            {mtuOver && (
              <div className="mt-3.5 flex items-center justify-between gap-2.5 border-t border-border pt-3.5">
                <span className="max-w-[55%] text-xs leading-snug text-muted-foreground">
                  New users may not be tracked until you upgrade.
                </span>
                <UpgradeButton projectId={projectId} plan={planId} billingEnabled={billingEnabled} size="sm" />
              </div>
            )}
          </UsageCard>

          <UsageCard label="Calls" used={calls} limit={callsLimit} compact>
            <div className="mt-3.5 border-t border-border pt-3.5 text-xs leading-snug text-muted-foreground">
              Soft guardrail — calls are metered but never blocked.
            </div>
          </UsageCard>
        </div>

        <p className="mt-4 text-[13px] text-muted-foreground">
          MTU is the headline limit (over it surfaces an upgrade); calls are a guardrail. Test traffic
          isn’t metered.
        </p>
      </TabsContent>

      {/* ---- Plan ---- */}
      <TabsContent value="plan">
        <PlanSection
          projectId={projectId}
          plan={planId}
          billingEnabled={billingEnabled}
          hasCustomer={hasCustomer}
        />
      </TabsContent>

      {/* ---- API keys ---- */}
      <TabsContent value="keys">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">API keys</h2>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "test", label: "Test" },
              { value: "live", label: "Live" },
            ]}
          />
        </div>

        <div className="mt-5 rounded-[12px] border border-border bg-surface p-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={mode === "live" ? "live" : "neutral"}>{mode}</Badge>
                <code className="font-mono text-[13px] text-foreground-2">bsk_{mode}_••••••••</code>
              </div>
              <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                {keyForMode?.lastUsedAt
                  ? `last used ${new Date(keyForMode.lastUsedAt).toLocaleString()}`
                  : "never used"}
              </div>
            </div>
            <Regenerate projectId={projectId} mode={mode} />
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Keys are shown once at creation. Lost it? Regenerate — the old key stops working immediately.
        </p>
      </TabsContent>

      {/* ---- Quickstart ---- */}
      <TabsContent value="quickstart">
        <h2 className="text-lg font-semibold">Quickstart</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Paste your live key into the environment, then point the counter at it.
        </p>
        <div className="mt-5 grid gap-3">
          <CodeBlock filename=".env" copy={`BISMITE_API_KEY=<your live key>`}>
            <span className="text-[var(--color-ident)]">BISMITE_API_KEY</span>=
            <span className="text-[var(--color-str)]">&lt;your live key&gt;</span>
          </CodeBlock>
          <CodeBlock
            filename="bismite.config.ts"
            copy={`import { bismiteCounter } from "bismite/hosted";\n\ncounter: bismiteCounter(process.env.BISMITE_API_KEY!)`}
          >
            <span className="text-[var(--color-kw)]">import</span> {"{ "}
            <span className="text-[var(--color-method)]">bismiteCounter</span>
            {" } "}
            <span className="text-[var(--color-kw)]">from</span>{" "}
            <span className="text-[var(--color-str)]">&quot;bismite/hosted&quot;</span>
            {"\n\n"}
            <span className="text-[var(--color-kw)]">counter</span>:{" "}
            <span className="text-[var(--color-method)]">bismiteCounter</span>(
            <span className="text-[var(--color-kw)]">process</span>.env.
            <span className="text-[var(--color-ident)]">BISMITE_API_KEY</span>!)
          </CodeBlock>
        </div>
      </TabsContent>
    </Tabs>
  );
}
