"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Mode } from "@/lib/counter";
import { PLANS, type PlanId } from "@/lib/plans";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UsageCard, meterState } from "@/components/meter";
import { TrendChart } from "@/components/trend-chart";
import type { UsageSnapshot } from "@/lib/counter";
import { Segmented } from "@/components/segmented";
import { CodeBlock } from "@/components/code-block";
import { Regenerate } from "./regenerate";
import { PlanSection, UpgradeButton } from "./plan-select";

interface KeyView {
  mode: Mode;
  lastUsedAt: string | null;
}

// ponytail: tiny regex tokenizer for these authored snippets — no highlighter dep
// (the two static snippets below stay hand-colored; this covers the longer examples).
const HL =
  /(\/\/[^\n]*)|(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(import|from|export|const|let|await|async|function|return|if|else|new|type|default)\b|\b(\d[\d_]*)\b/g;
const HL_VAR = { c: "--color-comment", s: "--color-str", k: "--color-kw", m: "--color-num" } as const;
function highlight(code: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  HL.lastIndex = 0;
  while ((m = HL.exec(code))) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : "m";
    out += `<span style="color:var(${HL_VAR[cls]})">${esc(m[0])}</span>`;
    last = HL.lastIndex;
  }
  return out + esc(code.slice(last));
}

function Snippet({ filename, code }: { filename: string; code: string }) {
  return (
    <CodeBlock filename={filename} copy={code}>
      <span dangerouslySetInnerHTML={{ __html: highlight(code) }} />
    </CodeBlock>
  );
}

// In-app quickstart examples — mirror QUICKSTART.md (gate → expensive call → meter).
const FRAMEWORKS = {
  app: {
    label: "App Router",
    filename: "app/api/chat/route.ts",
    code: `import { bismite } from "@/bismite.config";

export async function POST(req: Request) {
  const { userId, message } = await req.json();

  // GATE — before the expensive call
  const access = await bismite.check(userId, "chat-message");
  if (!access.allowed)
    return Response.json({ upgradeUrl: access.upgradeUrl }, { status: 402 });

  const reply = await callYourLLM(message);

  // METER — after (you only know the cost once it returns)
  await bismite.record(userId, "chat-message", { count: 1 });
  return Response.json({ reply });
}`,
  },
  pages: {
    label: "Pages Router",
    filename: "pages/api/chat.ts",
    code: `import type { NextApiRequest, NextApiResponse } from "next";
import { bismite } from "@/bismite.config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, message } = req.body;

  const access = await bismite.check(userId, "chat-message");   // gate
  if (!access.allowed)
    return res.status(402).json({ upgradeUrl: access.upgradeUrl });

  const reply = await callYourLLM(message);

  await bismite.record(userId, "chat-message", { count: 1 });   // meter
  res.json({ reply });
}`,
  },
  ai: {
    label: "Vercel AI SDK",
    filename: "app/api/chat/route.ts",
    code: `import { streamText } from "ai";
import { bismite } from "@/bismite.config";

export async function POST(req: Request) {
  const { userId, messages } = await req.json();

  // GATE on tokens-so-far — you don't know this call's cost yet
  const access = await bismite.check(userId, "chat-message");
  if (!access.allowed)
    return Response.json({ upgradeUrl: access.upgradeUrl }, { status: 402 });

  const result = streamText({
    model: "openai/gpt-4o-mini",
    messages,
    // METER the real token usage once the stream finishes
    onFinish: ({ usage }) =>
      bismite.record(userId, "chat-message", { tokens: usage.totalTokens }),
  });

  return result.toUIMessageStreamResponse();
}`,
  },
} as const;
type Framework = keyof typeof FRAMEWORKS;

export function ProjectTabs({
  projectId,
  period,
  mtu,
  calls,
  history,
  mtuLimit,
  callsLimit,
  planId,
  planName,
  keys,
  billingEnabled,
  hasCustomer,
  canManageKeys,
  canManageBilling,
  upgraded,
}: {
  projectId: string;
  period: string;
  mtu: number;
  calls: number;
  history: UsageSnapshot[];
  mtuLimit: number;
  callsLimit: number;
  planId: PlanId;
  planName: string;
  keys: KeyView[];
  billingEnabled: boolean;
  hasCustomer: boolean;
  canManageKeys: boolean;
  canManageBilling: boolean;
  upgraded: boolean;
}) {
  const [mode, setMode] = useState<Mode>("live");
  const [fw, setFw] = useState<Framework>("app");

  // Returned from Stripe Checkout success.
  useEffect(() => {
    if (upgraded) toast.success("Upgrade complete — your new plan is active.");
  }, [upgraded]);

  const mtuOver = meterState(mtu, mtuLimit) === "over";
  const callsOver = meterState(calls, callsLimit) === "over";
  // On a tier that bills overage (Pro), over-MTU is expected/billed, not a hard block. On
  // Free (no overage rate) it IS a hard block — new users past the ceiling are refused.
  const overageRate = PLANS[planId].mtuOveragePer1k;
  const mtuTone = overageRate == null ? "blocked" : "overage";
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
          <UsageCard
            label="Monthly Tracked Users"
            used={mtu}
            limit={mtuLimit}
            overTone={mtuTone}
            overageNote={overageRate != null ? `billed €${overageRate}/1k` : undefined}
          >
            {mtuOver && mtuTone === "blocked" && (
              <div className="mt-3.5 flex items-center justify-between gap-2.5 border-t border-border pt-3.5">
                <span className="max-w-[55%] text-xs leading-snug text-muted-foreground">
                  New users past your limit are blocked until you upgrade.
                </span>
                {canManageBilling ? (
                  <UpgradeButton projectId={projectId} plan={planId} billingEnabled={billingEnabled} size="sm" />
                ) : (
                  <span className="text-xs text-muted-foreground">Ask the org owner to upgrade.</span>
                )}
              </div>
            )}
            {mtuOver && mtuTone === "overage" && (
              <div className="mt-3.5 border-t border-border pt-3.5 text-xs leading-snug text-muted-foreground">
                Above your included MTU — extra is billed at €{overageRate} per 1,000. Your app keeps running.
              </div>
            )}
          </UsageCard>

          <UsageCard label="Calls" used={calls} limit={callsLimit} compact>
            <div className="mt-3.5 border-t border-border pt-3.5 text-xs leading-snug text-muted-foreground">
              {callsOver
                ? "Over your plan's call ceiling — further calls are blocked. Contact sales to raise it."
                : "Fair-use ceiling — calls are metered; over the ceiling they're blocked."}
            </div>
          </UsageCard>
        </div>

        <p className="mt-4 text-[13px] text-muted-foreground">
          MTU is the billed meter (Free blocks past the limit; Pro bills overage). Calls are a hard
          fair-use ceiling. Test traffic isn’t metered.
        </p>

        <h3 className="mt-8 text-[15px] font-semibold">Trend</h3>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Daily snapshots — history starts the day you do.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TrendChart
            label="Monthly Tracked Users"
            data={history.map((s) => ({ date: s.date, value: s.mtu }))}
            gradientId="trend-mtu"
            from="#9B7CFF"
            to="#7CB5FF"
          />
          <TrendChart
            label="Calls"
            data={history.map((s) => ({ date: s.date, value: s.calls }))}
            gradientId="trend-calls"
            from="#7CB5FF"
            to="#9B7CFF"
          />
        </div>
      </TabsContent>

      {/* ---- Plan ---- */}
      <TabsContent value="plan">
        <PlanSection
          projectId={projectId}
          plan={planId}
          billingEnabled={billingEnabled}
          hasCustomer={hasCustomer}
          canManageBilling={canManageBilling}
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
            {canManageKeys ? (
              <Regenerate projectId={projectId} mode={mode} />
            ) : (
              <span className="text-xs text-muted-foreground">Admins manage keys</span>
            )}
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

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold">Use it in your app</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Gate before the expensive call, meter after. Same SDK in any stack.
            </p>
          </div>
          <Segmented
            value={fw}
            onChange={setFw}
            options={[
              { value: "app", label: "App Router" },
              { value: "pages", label: "Pages Router" },
              { value: "ai", label: "AI SDK" },
            ]}
          />
        </div>
        <div className="mt-4">
          <Snippet filename={FRAMEWORKS[fw].filename} code={FRAMEWORKS[fw].code} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
