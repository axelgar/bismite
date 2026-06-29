import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Status pills (PRD usage states + key modes). Mono, tracked, pill-shaped — matches the
// Halo style tile's LIVE / HEALTHY / APPROACHING / OVER-LIMIT chips.
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] leading-none",
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface text-muted-foreground",
        live: "border-[rgba(155,124,255,0.32)] bg-[rgba(155,124,255,0.12)] text-accent-tint tracking-[0.08em]",
        success: "border-[rgba(62,207,142,0.3)] bg-[rgba(62,207,142,0.1)] text-success",
        warning: "border-[rgba(232,179,57,0.3)] bg-[rgba(232,179,57,0.1)] text-warning",
        over: "border-[rgba(242,121,61,0.36)] bg-[rgba(242,121,61,0.12)] text-over",
        danger: "border-[rgba(240,85,106,0.36)] bg-[rgba(240,85,106,0.12)] text-destructive",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
