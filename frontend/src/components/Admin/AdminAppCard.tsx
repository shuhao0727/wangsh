import React from "react";
import { Button, Card, Switch, Typography } from "antd";

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
  color?: string; // Add color prop
};

const AdminAppCard: React.FC<Props> = ({
  title,
  description,
  icon,
  enabled,
  onToggle,
  loading,
  actionLabel,
  actionIcon,
  onAction,
  color = "var(--ws-color-primary)",
}) => {
  return (
    <Card
      hoverable
      style={{
        borderRadius: "var(--ws-radius-lg)",
        border: "none",
        boxShadow: "none",
        height: "100%",
        transition: "all 0.2s ease",
        background: "var(--ws-color-surface-2)",
      }}
      styles={{
        body: { padding: "16px 12px 12px 12px", display: "flex", flexDirection: "column", alignItems: "center", height: "100%" },
      }}
    >
      <div
        style={{
          fontSize: 24,
          marginBottom: 8,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 32,
          width: 32,
        }}
      >
        {icon}
      </div>

      <Title level={4} style={{ marginBottom: 4, color: "var(--ws-color-text)", fontSize: 15, fontWeight: 600, textAlign: "center" }}>
        {title}
      </Title>
      
      <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.3, textAlign: "center", marginBottom: 12, maxWidth: "180px", minHeight: "32px", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {description}
      </Text>

      <div style={{ width: "100%", marginTop: "auto", borderTop: "1px solid rgba(0,0,0,0.04)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Switch size="small" checked={enabled} loading={loading} onChange={onToggle} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {enabled ? "已启用" : "已禁用"}
          </Text>
        </div>

        {onAction && actionLabel ? (
          <Button type="link" size="small" icon={actionIcon} onClick={onAction} style={{ padding: 0 }}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </Card>
  );
};

export default AdminAppCard;
