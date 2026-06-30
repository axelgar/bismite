// Hand-rolled SVG line chart for the two usage trends (observability PRD-C #5).
// ponytail: two simple line charts don't justify a charting dependency. A 100×40
// viewBox stretched to full width with non-scaling strokes keeps it crisp at any
// size. Add a real lib only if these need axes/tooltips/zoom later.
import * as React from "react";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

/** Compact axis-ish labels: 2,100,000 → "2.1M", 12,400 → "12.4K". */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const W = 100;
const H = 40;

export function TrendChart({
  data,
  label,
  gradientId,
  from,
  to,
}: {
  data: TrendPoint[];
  label: string;
  gradientId: string;
  from: string;
  to: string;
}) {
  const latest = data.length ? data[data.length - 1].value : 0;

  // Need ≥2 points to draw a line. One point or none → a calm "collecting" state
  // so a brand-new project doesn't render a broken/empty chart.
  if (data.length < 2) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-[18px]">
        <Header label={label} latest={latest} />
        <div className="mt-4 flex h-[40px] items-center text-[12px] text-muted-foreground">
          Collecting history — the trend fills in once there are a couple of daily snapshots.
        </div>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1); // avoid /0 on all-zero history
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;

  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;

  return (
    <div className="rounded-[12px] border border-border bg-surface p-[18px]">
      <Header label={label} latest={latest} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-4 h-[56px] w-full"
        role="img"
        aria-label={`${label} over time, latest ${fmt(latest)}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={from} stopOpacity="0.18" />
            <stop offset="100%" stopColor={from} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gradientId}-fill)`} />
        <polyline
          points={line}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
}

function Header({ label, latest }: { label: string; latest: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[13px] font-medium text-foreground-2">{label}</span>
      <span className="font-mono text-[13px] text-foreground-2">{fmt(latest)}</span>
    </div>
  );
}
