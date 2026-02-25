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
  theme?: "blue" | "orange";
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
  theme = "blue",
}) => {
  const iconStyle =
    theme === "orange"
      ? {
          background: "linear-gradient(135deg, #fff2e8 0%, #ffbb96 100%)",
          color: "#d4380d",
        }
      : {
          background: "linear-gradient(135deg, #e6f7ff 0%, #1890ff 100%)",
          color: "#fff",
        };

  return (
    <Card
      hoverable
      style={{
        borderRadius: 8,
        border: "1px solid #f0f0f0",
        height: "100%",
        transition: "all 0.3s ease",
      }}
      styles={{
        body: { padding: 24, display: "flex", flexDirection: "column", height: "100%" },
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 20 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            marginRight: 16,
            flexShrink: 0,
            ...iconStyle,
          }}
        >
          {icon}
        </div>
        <div>
          <Title level={5} style={{ marginBottom: 4, color: "#2c3e50", fontSize: 16 }}>
            {title}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5, display: "block" }}>
            {description}
          </Text>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
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

