
import React from "react";
import { Typography } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

export interface StatusItemProps {
  label: string;
  value: React.ReactNode;
  status?: "success" | "error" | "default";
}

const StatusItem: React.FC<StatusItemProps> = ({ label, value, status }) => (
  <div className="admin-status-item">
    <Text type="secondary" className="admin-status-item__label">
      {label}
    </Text>
    <div className="admin-status-item__value">
      {status === "success" && <CheckCircleOutlined style={{ color: "var(--ws-color-success)" }} />}
      {status === "error" && <CloseCircleOutlined style={{ color: "var(--ws-color-error)" }} />}
      <span className="admin-status-item__value-text">{value}</span>
    </div>
  </div>
);

export default React.memo(StatusItem);
