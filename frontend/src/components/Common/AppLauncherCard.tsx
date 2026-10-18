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
  layout?: "card" | "row";
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
  layout = "card",
}) => {
  const isRow = layout === "row";

  return (
    <button
      type="button"
      className={[
        "appearance-none it-app-card relative flex h-full w-full border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isRow
          ? "it-app-card-embedded min-h-[76px] flex-row items-center gap-[var(--ws-space-2)] px-[var(--ws-space-2)] py-[var(--ws-space-2)] text-left"
          : "min-h-[var(--ws-module-card-min-height)] flex-col items-center rounded-xl bg-surface-2 px-[var(--ws-space-2)] py-[var(--ws-space-3)] text-center",
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
      <div className={`it-app-icon flex shrink-0 items-center justify-center bg-[var(--app-bg)] text-[var(--app-color)] ${isRow ? "h-9 w-9 rounded-md" : "mb-2 h-10 w-10 rounded-xl"}`}>
        {icon}
      </div>

      <div className={isRow ? "min-w-0 flex-1 text-left" : "w-full"}>
        <div className={`text-[var(--ws-text-md)] font-semibold text-text-base ${isRow ? "truncate" : "mb-1.5"}`}>{title}</div>
        <div className={`text-[var(--ws-text-caption)] leading-relaxed text-text-secondary ${isRow ? "line-clamp-1" : "mb-2.5"}`}>{description}</div>

        {stats && stats.length > 0 ? (
          <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 ${isRow ? "mt-1 justify-start" : "mb-2.5 justify-center"}`}>
            {stats.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-sm bg-[var(--app-bg)] px-1.5 py-0.5 text-[11px] text-text-tertiary">
                <span className="font-semibold text-[var(--app-color)]">{s.value}</span>
                {s.label}
              </span>
            ))}
          </div>
        ) : null}

        {progress !== undefined && progress >= 0 ? (
          <div className={`space-y-1 ${isRow ? "mt-1 max-w-40" : "mb-2 w-full"}`}>
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
      </div>

      {badgeText ? (
        <Badge variant="warning" className={isRow ? "shrink-0" : "absolute right-[var(--ws-space-2)] top-[var(--ws-space-2)]"}>
          {badgeText}
        </Badge>
      ) : null}

      {disabled ? (
        <span className="shrink-0 text-xs text-text-tertiary">{disabledLabel}</span>
      ) : (
        isRow ? (
          <ArrowRight className="it-app-arrow h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
        ) : (
          <div className="flex items-center gap-1 text-sm font-medium text-[var(--app-color)]">
            {actionLabel}
            <ArrowRight className="it-app-arrow h-4 w-4 text-xs" />
          </div>
        )
      )}
    </button>
  );
};

export default AppLauncherCard;
