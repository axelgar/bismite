import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[9px] border border-input bg-surface px-3.5 py-2 text-sm text-foreground placeholder:text-faint outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:shadow-[0_0_0_3px_rgba(155,124,255,0.2)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
