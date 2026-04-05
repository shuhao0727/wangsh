import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/10",
        info: "border-blue-500/20 bg-blue-500/10 text-blue-600 hover:bg-blue-500/10",
        neutral: "border-slate-500/20 bg-slate-500/10 text-slate-600 hover:bg-slate-500/10",
        sky: "border-sky-500/20 bg-sky-500/10 text-sky-600 hover:bg-sky-500/10",
        danger: "border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/10",
        violet: "border-violet-500/20 bg-violet-500/10 text-violet-600 hover:bg-violet-500/10",
        purple: "border-transparent bg-purple/15 text-purple hover:bg-purple/15",
        primarySubtle: "border-primary/20 bg-primary/10 text-primary hover:bg-primary/10",
        cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
