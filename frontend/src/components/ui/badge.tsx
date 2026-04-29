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
        success: "border-[color-mix(in_srgb,var(--ws-color-success),transparent_80%)] bg-success-soft text-success hover:bg-success-soft",
        warning: "border-[color-mix(in_srgb,var(--ws-color-warning),transparent_80%)] bg-warning-soft text-warning hover:bg-warning-soft",
        info: "border-[color-mix(in_srgb,var(--ws-color-primary),transparent_80%)] bg-primary-soft text-primary hover:bg-primary-soft",
        neutral: "border-[color-mix(in_srgb,var(--ws-color-text-secondary),transparent_80%)] bg-[color-mix(in_srgb,var(--ws-color-text-secondary),transparent_90%)] text-text-secondary hover:bg-[color-mix(in_srgb,var(--ws-color-text-secondary),transparent_90%)]",
        sky: "border-[color-mix(in_srgb,var(--ws-color-primary),transparent_80%)] bg-primary-soft text-primary hover:bg-primary-soft",
        danger: "border-[color-mix(in_srgb,var(--ws-color-error),transparent_80%)] bg-error-soft text-error hover:bg-error-soft",
        violet: "border-[color-mix(in_srgb,var(--ws-color-purple),transparent_80%)] bg-purple-soft text-purple hover:bg-purple-soft",
        purple: "border-transparent bg-purple-soft text-purple hover:bg-purple-soft",
        primarySubtle: "border-[color-mix(in_srgb,var(--ws-color-primary),transparent_80%)] bg-primary-soft text-primary hover:bg-primary-soft",
        cyan: "border-[color-mix(in_srgb,var(--ws-color-accent),transparent_80%)] bg-[color-mix(in_srgb,var(--ws-color-accent),transparent_90%)] text-[var(--ws-color-accent)] hover:bg-[color-mix(in_srgb,var(--ws-color-accent),transparent_90%)]",
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
