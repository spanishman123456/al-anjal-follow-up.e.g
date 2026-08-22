import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "premium-interactive inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:translate-y-[-1px] active:translate-y-0 active:scale-[0.98] disabled:hover:translate-y-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-violet-700 via-purple-700 to-cyan-700 text-white shadow-[0_10px_24px_-15px_rgba(6,182,212,0.95)] hover:from-violet-600 hover:via-purple-600 hover:to-cyan-600 hover:shadow-[0_14px_28px_-13px_rgba(6,182,212,0.9)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm shadow-red-900/10 hover:bg-destructive/90 hover:shadow-md hover:shadow-red-500/20",
        outline:
          "border border-input bg-background/70 text-foreground shadow-sm hover:border-cyan-400/45 hover:bg-cyan-50/70 hover:text-foreground hover:shadow-[0_10px_22px_-17px_rgba(6,182,212,0.9)] dark:border-white/20 dark:bg-white/[0.03] dark:hover:bg-cyan-400/10 dark:hover:text-foreground",
        secondary:
          "border border-violet-300/30 bg-secondary text-secondary-foreground shadow-sm hover:border-cyan-400/40 hover:bg-secondary/85 hover:shadow-[0_10px_22px_-17px_rgba(139,43,236,0.9)]",
        success:
          "bg-success text-success-foreground shadow-sm hover:bg-success/90 hover:shadow-md hover:shadow-emerald-500/20",
        ghost: "text-foreground hover:bg-cyan-500/10 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-full px-3 text-xs",
        lg: "h-10 rounded-full px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
