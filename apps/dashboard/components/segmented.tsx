"use client";
import { cn } from "@/lib/utils";

// Test/Live segmented toggle (Halo). Controlled — the parent owns the selected mode.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      role="tablist"
      className="inline-flex rounded-[8px] border border-border bg-background p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "cursor-pointer rounded-[6px] px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
