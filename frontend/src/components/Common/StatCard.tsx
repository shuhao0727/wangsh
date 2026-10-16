import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "default" | "accent" | "horizontal";
  color?: string;
  className?: string;
}

const COLOR_MAP: Record<string, { accent: string; icon: string; bg: string }> = {
  primary: { accent: "var(--ws-color-primary)", icon: "var(--ws-color-primary)", bg: "var(--ws-color-primary-soft)" },
  success: { accent: "var(--ws-color-success)", icon: "var(--ws-color-success)", bg: "var(--ws-color-success-soft)" },
  warning: { accent: "var(--ws-color-warning)", icon: "var(--ws-color-warning)", bg: "var(--ws-color-warning-soft)" },
  error: { accent: "var(--ws-color-error)", icon: "var(--ws-color-error)", bg: "var(--ws-color-error-soft)" },
  purple: { accent: "var(--ws-color-purple)", icon: "var(--ws-color-purple)", bg: "var(--ws-color-purple-soft)" },
  secondary: { accent: "var(--ws-color-secondary)", icon: "var(--ws-color-secondary)", bg: "var(--ws-color-primary-soft)" },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  variant = "default",
  color = "primary",
  className,
}) => {
  const colors = COLOR_MAP[color] ?? COLOR_MAP.primary;

  if (variant === "accent") {
    return (
      <div
        className={cn(
          "stat-card relative overflow-hidden rounded-lg border border-[var(--ws-color-border)] bg-[var(--ws-color-surface-2)] p-3 transition-shadow hover:shadow-md",
          className,
        )}
      >
        <div
          className="stat-card-accent absolute inset-y-0 left-0 w-[3px] opacity-85"
          style={{ background: colors.accent }}
        />
        <div className="stat-card-body relative z-10">
          <div className="stat-card-label mb-1 flex items-center gap-1.5 text-xs text-text-tertiary">
            {icon ? (
              <span className="stat-card-icon" style={{ color: colors.icon }}>
                {icon}
              </span>
            ) : null}
            {label}
          </div>
          <div className="stat-card-value text-xl font-bold text-text-base leading-tight tabular-nums">
            {value}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "horizontal") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border border-[var(--ws-color-border)] bg-[var(--ws-color-surface-2)] px-3 py-2.5",
          className,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: colors.bg, color: colors.icon }}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 text-sm text-text-tertiary">
            {label}
          </div>
        </div>
        <div className="shrink-0 text-right text-xl font-semibold leading-6 text-text-base tabular-nums">
          {value}
        </div>
      </div>
    );
  }

  // default
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--ws-color-border)] bg-[var(--ws-color-surface-2)] p-3",
        className,
      )}
    >
      <div className="mb-1 text-xs text-text-tertiary">{label}</div>
      <div className="text-xl font-bold text-text-base tabular-nums">{value}</div>
    </div>
  );
};
