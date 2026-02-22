import React from "react";
import { Empty, Spin } from "antd";

type Props = {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
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
  children,
  pagination,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {(title || extra) && (
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          padding: "12px 24px",
          borderBottom: "none" // Remove divider
        }}>
          {title && <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>}
          {extra && <div>{extra}</div>}
        </div>
      )}
      
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Spin size="large" />
          </div>
        ) : isEmpty ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription}>
              {emptyAction}
            </Empty>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
             {children}
          </div>
        )}
      </div>
      
      {pagination ? (
        <div style={{ 
          padding: "12px 24px", 
          borderTop: "none", // Remove divider
          textAlign: "right",
          background: "#fff"
        }}>
          {pagination}
        </div>
      ) : null}
    </div>
  );
};

export default AdminTablePanel;
