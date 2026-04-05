
import React from "react";
import { CheckCircle, XCircle } from "lucide-react";

export interface StatusItemProps {
  label: string;
  value: React.ReactNode;
  status?: "success" | "error" | "default";
}

const StatusItem: React.FC<StatusItemProps> = ({ label, value, status }) => (
  <div className="admin-status-item">
    <span className="admin-status-item__label text-text-secondary">
      {label}
    </span>
    <div className="admin-status-item__value">
      {status === "success" && <CheckCircle className="h-4 w-4 text-success" />}
      {status === "error" && <XCircle className="h-4 w-4 text-error" />}
      <span className="admin-status-item__value-text">{value}</span>
    </div>
  </div>
);

export default React.memo(StatusItem);
