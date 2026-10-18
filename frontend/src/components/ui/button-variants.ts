import { cva, type VariantProps } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-sm border-0 bg-transparent text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-none hover:bg-primary-active",
        destructive:
          "bg-destructive text-destructive-foreground shadow-none hover:bg-[var(--ws-color-error-dark)]",
        outline:
          "border border-[var(--ws-control-action-border)] bg-[var(--ws-control-action-bg)] text-text-secondary shadow-none hover:bg-surface-2 hover:text-text-base",
        secondary:
          "bg-primary-soft text-primary shadow-none hover:bg-[var(--ws-color-primary-light)]",
        ghost: "shadow-none hover:bg-primary-soft",
        link: "text-primary underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-[var(--ws-control-height)] px-[18px] py-1",
        sm: "h-[var(--ws-control-height-sm)] px-3 text-xs",
        lg: "h-[var(--ws-control-height-lg)] px-8",
        icon: "h-[var(--ws-control-height)] w-[var(--ws-control-height)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
