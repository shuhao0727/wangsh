import React from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type StatItem = { label: string; value: string };

type Props = {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  ring: string;
  onClick?: () => void;
  disabled?: boolean;
  actionLabel?: string;
  disabledLabel?: string;
  badgeText?: string;
  className?: string;
  stats?: StatItem[];
  progress?: number;
  progressLabel?: string;
};

const AppLauncherCard: React.FC<Props> = ({
  title,
  description,
  icon,
  color,
  bg,
  ring,
  onClick,
  disabled = false,
  actionLabel = "立即使用",
  disabledLabel = "敬请期待",
  badgeText,
  className,
  stats,
  progress,
  progressLabel,
}) => {
  return (
    <button
      type="button"
      className={[
        "appearance-none it-app-card relative flex h-full min-h-[var(--ws-module-card-min-height)] w-full flex-col items-center rounded-xl border-0 bg-surface-2 px-[var(--ws-space-2)] py-[var(--ws-space-3)] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className || "",
      ].join(" ")}
      style={{ "--app-bg": bg, "--app-ring": ring, "--app-color": color } as React.CSSProperties}
      aria-label={title}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => {
        if (disabled || !onClick) return;
        onClick();
      }}
    >
      {badgeText ? (
        <Badge variant="warning" className="absolute right-[var(--ws-space-2)] top-[var(--ws-space-2)]">
          {badgeText}
        </Badge>
      ) : null}

      <div className="it-app-icon mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-bg)] text-base text-[var(--app-color)]">
        {icon}
      </div>

      <div className="mb-1.5 text-[var(--ws-text-md)] font-semibold text-text-base">{title}</div>
      <div className="mb-2.5 text-[var(--ws-text-caption)] leading-relaxed text-text-secondary">{description}</div>

      {stats && stats.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          {stats.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-[var(--app-bg)] px-1.5 py-0.5 text-[11px] text-text-tertiary">
              <span className="font-semibold text-[var(--app-color)]">{s.value}</span>
              {s.label}
            </span>
          ))}
        </div>
      ) : null}

      {progress !== undefined && progress >= 0 ? (
        <div className="mb-2 w-full space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-tertiary">{progressLabel || "学习进度"}</span>
            <span className="font-medium text-[var(--app-color)]">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--app-bg)]">
            <div
              className="h-full rounded-full bg-[var(--app-color)] transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      ) : null}

      {disabled ? (
        <div className="text-sm text-text-tertiary">{disabledLabel}</div>
      ) : (
        <div className="flex items-center gap-1 text-sm font-medium text-[var(--app-color)]">
          {actionLabel}
          <ArrowRight className="it-app-arrow h-4 w-4 text-xs" />
        </div>
      )}
    </button>
  );
};

export default AppLauncherCard;
