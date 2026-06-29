import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] font-semibold transition-[box-shadow,background-color,border-color,opacity] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-[0_0_0_4px_rgba(155,124,255,0.18)]",
        secondary:
          "bg-[#1a1d27] text-foreground border border-input hover:border-[#3a4150]",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-surface",
        outline:
          "border border-border text-foreground hover:bg-surface hover:border-input",
        destructive:
          "bg-destructive text-primary-foreground hover:opacity-90 hover:shadow-[0_0_0_4px_rgba(240,85,106,0.18)]",
        link: "text-accent-tint underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-[13px]",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5 text-sm",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
