import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "block min-h-[80px] w-full rounded-sm border border-[var(--ws-control-border)] bg-[var(--ws-control-bg)] px-3 py-2 text-sm shadow-none transition-colors duration-150 placeholder:text-muted-foreground hover:border-text-tertiary focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
