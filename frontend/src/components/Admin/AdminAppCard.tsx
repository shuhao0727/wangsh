import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Props = {
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
  title, description, icon, enabled, onToggle, loading,
  actionLabel, actionIcon, onAction, color = "var(--ws-color-primary)",
  showToggle = true,
}) => (
  <div className="rounded-lg flex flex-col items-center p-3 h-full transition-all duration-200 hover:shadow-sm bg-surface-2">
    <div className="flex items-center justify-center w-8 h-8 rounded-lg mb-2 text-lg flex-shrink-0"
      style={{ color, background: `${color}18` }}>
      {icon}
    </div>

    <h5 className="mb-0.5 text-sm font-semibold text-center text-text-base">
      {title}
    </h5>

    <span className="text-xs text-text-secondary text-center mb-2 line-clamp-2 min-h-[30px] leading-relaxed">
      {description}
    </span>

    <div className="w-full mt-auto pt-2 flex items-center justify-between border-t border-border-secondary">
      {showToggle ? (
        <div className="flex items-center gap-1.5">
          <Switch checked={enabled} disabled={loading} onCheckedChange={onToggle} />
          <span className="text-xs text-text-tertiary">{enabled ? "已启用" : "已禁用"}</span>
        </div>
      ) : <span />}
      {onAction && actionLabel && (
        <Button variant="link" size="sm" onClick={onAction} className="!p-0 !h-auto !text-xs">
          {actionIcon}
          {actionLabel}
        </Button>
      )}
    </div>
  </div>
);

export default AdminAppCard;
