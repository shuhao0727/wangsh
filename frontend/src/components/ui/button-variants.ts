import { cva, type VariantProps } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border-0 bg-transparent text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ws-color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-none hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/90",
        outline:
          "border-0 bg-transparent text-foreground shadow-none hover:bg-[var(--ws-color-hover-bg)]",
        secondary:
          "bg-surface-2 text-secondary-foreground shadow-none hover:bg-border-secondary",
        ghost: "shadow-none hover:bg-[var(--ws-color-hover-bg)]",
        link: "text-primary underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-[var(--ws-control-height)] px-[18px] py-1",
        sm: "h-[var(--ws-control-height-sm)] rounded-lg px-3 text-xs",
        lg: "h-[var(--ws-control-height-lg)] rounded-lg px-8",
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
