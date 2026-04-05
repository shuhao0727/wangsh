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
};

const AdminAppCard: React.FC<Props> = ({
  title, description, icon, enabled, onToggle, loading,
  actionLabel, actionIcon, onAction, color = "var(--ws-color-primary)",
}) => (
  <div className="rounded-xl flex flex-col items-center px-3.5 pt-4 pb-3.5 h-full transition-all duration-200 hover:shadow-sm bg-surface-2">
    <div className="flex items-center justify-center w-11 h-11 rounded-xl mb-2.5 text-2xl flex-shrink-0"
      style={{ color, background: `${color}18` }}>
      {icon}
    </div>

    <h5 className="mb-1 text-base font-semibold text-center text-text-base">
      {title}
    </h5>

    <span className="text-sm text-text-secondary text-center mb-3 line-clamp-2 min-h-[38px] leading-relaxed">
      {description}
    </span>

    <div className="w-full mt-auto pt-2.5 flex items-center justify-between border-t border-border-secondary">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} disabled={loading} onCheckedChange={onToggle} />
        <span className="text-sm text-text-secondary">{enabled ? "已启用" : "已禁用"}</span>
      </div>
      {onAction && actionLabel && (
        <Button variant="link" size="sm" onClick={onAction} className="!p-0">
          {actionIcon}
          {actionLabel}
        </Button>
      )}
    </div>
  </div>
);

export default AdminAppCard;
