import React from "react";
import { Button, Switch, Typography } from "antd";

const { Text, Title } = Typography;

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
  <div className="rounded-xl flex flex-col items-center px-3 pt-4 pb-3 h-full transition-all duration-200 hover:shadow-sm bg-surface-2">
    <div className="flex items-center justify-center w-10 h-10 rounded-xl mb-2 text-2xl flex-shrink-0"
      style={{ color, background: `${color}18` }}>
      {icon}
    </div>

    <Title level={5} className="!mb-1 !text-sm font-semibold text-center text-text-base">
      {title}
    </Title>

    <Text type="secondary" className="text-xs text-center mb-3 line-clamp-2 min-h-[32px]">
      {description}
    </Text>

    <div className="w-full mt-auto pt-2.5 flex items-center justify-between border-t border-black/5">
      <div className="flex items-center gap-2">
        <Switch size="small" checked={enabled} loading={loading} onChange={onToggle} />
        <Text type="secondary" className="text-xs">{enabled ? "已启用" : "已禁用"}</Text>
      </div>
      {onAction && actionLabel && (
        <Button type="link" size="small" icon={actionIcon} onClick={onAction} className="!p-0">
          {actionLabel}
        </Button>
      )}
    </div>
  </div>
);

export default AdminAppCard;
