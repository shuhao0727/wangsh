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
  color = "var(--ws-color-primary)", // Default to primary
}) => {
  return (
    <Card
      hoverable
      style={{
        borderRadius: 8,
        border: "1px solid #f0f0f0", // Subtle border for definition
        borderTop: `4px solid ${color}`, // Top decorative line
        boxShadow: "none", // Default to no shadow
        height: "100%",
        transition: "all 0.3s ease",
        background: "#ffffff", // Explicit white background
      }}
      styles={{
        body: { padding: "16px 12px 12px 12px", display: "flex", flexDirection: "column", alignItems: "center", height: "100%" },
      }}
      // Add hover effect via JS or separate CSS class if needed, or rely on Antd hoverable
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)"; // Subtle hover shadow
        e.currentTarget.style.borderColor = "transparent"; // Remove side/bottom borders on hover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "#f0f0f0"; // Restore border color
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
      
      <Title level={4} style={{ marginBottom: 4, color: color, fontSize: 15, fontWeight: 600, textAlign: "center" }}>
        {title}
      </Title>
      
      <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.3, display: "block", textAlign: "center", marginBottom: 12, maxWidth: "180px", minHeight: "32px", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {description}
      </Text>

      <div style={{ width: "100%", marginTop: "auto", borderTop: "1px solid #f0f0f0", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

