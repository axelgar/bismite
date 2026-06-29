"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// The masked API-key field with an inline Copy + "Copied" confirm (Halo style tile). Used
// at the reveal moment, where we hold the full secret exactly once. Fires a toast too.
export function CopyField({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Couldn’t copy — select and copy manually");
    }
  }

  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-[10px] border border-border bg-background",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate px-3.5 py-3 font-mono text-[13px] text-foreground-2">
        {value}
      </span>
      <button
        type="button"
        onClick={copy}
        className="flex shrink-0 items-center gap-1.5 border-l border-border bg-[#16191f] px-4 font-mono text-xs font-semibold text-accent-tint transition-colors hover:bg-[#1d212a] focus-visible:outline-none"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
