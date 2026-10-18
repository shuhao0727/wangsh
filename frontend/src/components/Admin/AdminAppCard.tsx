import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Props = {
  className?: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  loading?: boolean;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  color?: string;
  showToggle?: boolean;
};

const AdminAppCard: React.FC<Props> = ({
  className,
  title, description, icon, enabled, onToggle, loading,
  actionLabel, actionIcon, onAction, color = "var(--ws-color-primary)",
  showToggle = true,
}) => (
  <div className={`ws-admin-app-row grid min-w-0 items-center gap-x-3 gap-y-2 p-3 transition-colors duration-150 hover:bg-primary-soft ${className ?? ""}`}>
    <div className="flex h-9 w-9 shrink-0 items-center justify-center text-lg" style={{ color }}>
      {icon}
    </div>
    <div className="min-w-0">
      <h5 className="text-sm font-semibold text-text-base">{title}</h5>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>
    </div>
    <div className="ws-admin-app-actions flex shrink-0 items-center justify-end gap-3">
      {showToggle ? (
        <div className="flex items-center gap-1.5">
          <Switch aria-label={`${title}启用状态`} checked={enabled} disabled={loading} onCheckedChange={onToggle} />
          <span className="text-xs text-text-tertiary">{enabled ? "已启用" : "已禁用"}</span>
        </div>
      ) : <span />}
      {onAction && actionLabel && (
        <Button variant="ghost" size="sm" onClick={onAction} className="h-8 px-2 text-sm text-primary">
          {actionIcon}
          {actionLabel}
        </Button>
      )}
    </div>
  </div>
);

export default AdminAppCard;
