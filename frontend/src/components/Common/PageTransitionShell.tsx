import React from "react";

type PageTransitionShellProps = {
  children: React.ReactNode;
  /** @default "fade" */
  variant?: "fade" | "slide-up" | "none";
  className?: string;
};

/**
 * 轻量页面转场外壳。为路由内容提供统一的进入动画，
 * 并在 prefers-reduced-motion 时自动降级为无动画。
 */
export const PageTransitionShell: React.FC<PageTransitionShellProps> = ({
  children,
  variant = "fade",
  className = "",
}) => {
  if (variant === "none") return <>{children}</>;

  const motionClass =
    variant === "fade"
      ? "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200";

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${motionClass} ${className}`}>
      {children}
    </div>
  );
};
