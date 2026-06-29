"use client";
import { Toaster as Sonner } from "sonner";

// Toast feedback for copy / regenerate / upgrade-returned. Themed to Halo via CSS vars
// rather than next-themes (the dashboard is dark-only).
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-foreground)",
          fontFamily: "var(--font-sans)",
          borderRadius: "12px",
        },
      }}
    />
  );
}
