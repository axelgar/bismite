import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Usage meter with the three Halo states. MTU is the headline (over-limit is the hero
// moment: orange→red fill + glow + upgrade CTA); calls are the softer guardrail.
export type MeterState = "healthy" | "approaching" | "over";

export function meterState(used: number, limit: number): MeterState {
  if (!isFinite(limit) || limit <= 0) return "healthy"; // unlimited (enterprise)
  const pct = (used / limit) * 100;
  if (pct >= 100) return "over";
  if (pct >= 75) return "approaching";
  return "healthy";
}

const FILL: Record<MeterState, string> = {
  healthy: "linear-gradient(90deg,#9B7CFF,#7CB5FF)",
  approaching: "linear-gradient(90deg,#E8B339,#F0A33A)",
  over: "linear-gradient(90deg,#F2793D,#F0556A)",
};

const BADGE: Record<MeterState, { variant: "success" | "warning" | "over"; label: string }> = {
  healthy: { variant: "success", label: "Healthy" },
  approaching: { variant: "warning", label: "Approaching" },
  over: { variant: "over", label: "Over limit" },
};

/** Compact for large counts (calls): 2,100,000 → "2.10M". */
function fmt(n: number): string {
  if (!isFinite(n)) return "∞";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Just the track + animated fill — reusable on its own. */
export function MeterBar({ pct, state }: { pct: number; state: MeterState }) {
  return (
    <div className="h-2 overflow-hidden rounded-[6px] border border-border bg-background">
      <div
        className="animate-meter h-full rounded-[6px]"
        style={{ width: `${Math.min(100, pct)}%`, background: FILL[state] }}
      />
    </div>
  );
}

// When a meter is over its limit, what does that MEAN? "blocked" = a hard ceiling was hit
// (Free MTU, or any tier's calls ceiling) → red alarm + "over ceiling". "overage" = expected,
// billed usage above the included amount (Pro MTU) → softer amber, never alarming a paying
// customer who's working as intended.
export type OverTone = "blocked" | "overage";

export function UsageCard({
  label,
  used,
  limit,
  compact = false,
  overTone = "blocked",
  overageNote,
  children,
}: {
  label: string;
  used: number;
  limit: number;
  compact?: boolean;
  overTone?: OverTone;
  overageNote?: string;
  children?: React.ReactNode;
}) {
  const state = meterState(used, limit);
  const isOverage = state === "over" && overTone === "overage";
  const badge = isOverage ? { variant: "warning" as const, label: "Overage" } : BADGE[state];
  // Overage reuses the amber "approaching" fill — over-the-line but healthy, not a red alarm.
  const fillState = isOverage ? "approaching" : state;
  const pct = isFinite(limit) && limit > 0 ? Math.round((used / limit) * 100) : 0;
  const over = isFinite(limit) ? Math.max(0, used - limit) : 0;
  const overStr = compact ? fmt(over) : over.toLocaleString();

  const caption =
    state === "over"
      ? isOverage
        ? `${overStr} over included${overageNote ? ` · ${overageNote}` : ""}`
        : `${pct}% · ${overStr} over ceiling`
      : state === "approaching"
        ? `${pct}% — approaching limit`
        : isFinite(limit)
          ? `${pct}% used`
          : "unlimited";

  const captionColor =
    isOverage || state === "approaching"
      ? "text-warning"
      : state === "over"
        ? "text-over"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-[12px] border border-border bg-surface p-[18px] pb-4",
        // Red alarm glow only for a HARD block — never for billed overage.
        state === "over" && !isOverage &&
          "border-[rgba(242,121,61,0.4)] shadow-[inset_0_0_0_1px_rgba(242,121,61,0.06),0_0_36px_-18px_rgba(242,121,61,0.4)]",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-foreground-2">{label}</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="mt-3.5 font-mono text-[27px] font-medium leading-none text-[#f2f3f5]">
        {compact ? fmt(used) : used.toLocaleString()}{" "}
        <span className="text-[15px] text-faint">/ {compact ? fmt(limit) : isFinite(limit) ? limit.toLocaleString() : "∞"}</span>
      </div>

      <div className="mt-3.5">
        <MeterBar pct={pct} state={fillState} />
      </div>
      <div className={cn("mt-2.5 font-mono text-[11px] leading-none", captionColor)}>{caption}</div>

      {children}
    </div>
  );
}
