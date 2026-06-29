"use client";
import { TriangleAlert } from "lucide-react";
import { CopyField } from "@/components/copy-field";
import { CodeBlock } from "@/components/code-block";

// Show-once secret reveal + the copy-paste onboarding snippet (PRD §5 / issue #4). The
// snippet references the env var, not the literal secret, so it's still correct after the
// secret scrolls off — the developer pastes the key into BISMITE_API_KEY themselves.
export function RevealKeys({ test, live }: { test: string; live: string }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(232,179,57,0.35)] bg-[rgba(232,179,57,0.08)] p-3 text-[13px] text-warning">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <span>Store these now — they’re shown once and can’t be retrieved later. Regenerate to get a fresh one.</span>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Test key</span>
          <CopyField value={test} />
        </div>
        <div className="grid gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Live key</span>
          <CopyField value={live} />
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-[13px] font-medium text-foreground-2">Drop it into your app</span>
        <CodeBlock
          filename="bismite.config.ts"
          copy={`import { bismiteCounter } from "bismite/hosted";\n\ncounter: bismiteCounter(process.env.BISMITE_API_KEY!)`}
        >
          <span className="text-[var(--color-kw)]">import</span>{" "}
          {"{ "}
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
    </div>
  );
}
