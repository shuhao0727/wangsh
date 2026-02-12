import React from "react";
import { Empty, Spin } from "antd";
import AdminCard from "./AdminCard";

type Props = {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  accentColor?: string;
  gradient?: string;
  children: React.ReactNode;
  pagination?: React.ReactNode;
};

const AdminTablePanel: React.FC<Props> = ({
  title,
  extra,
  loading = false,
  isEmpty = false,
  emptyDescription,
  emptyAction,
  accentColor = "var(--ws-color-success)",
  gradient = "var(--ws-color-surface)",
  children,
  pagination,
}) => {
  return (
    <AdminCard title={title} extra={extra} accentColor={accentColor} gradient={gradient}>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <Spin size="large" />
        </div>
      ) : isEmpty ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription}>
          {emptyAction}
        </Empty>
      ) : (
        <>
          {children}
          {pagination ? <div style={{ marginTop: "24px", textAlign: "center" }}>{pagination}</div> : null}
        </>
      )}
    </AdminCard>
  );
};

export default AdminTablePanel;
