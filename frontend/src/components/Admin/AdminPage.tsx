import React from "react";

type Props = {
  children: React.ReactNode;
  maxWidth?: number;
  padding?: number | string;
  scrollable?: boolean;
};

const AdminPage: React.FC<Props> = ({
  children,
  maxWidth,
  padding = "var(--ws-panel-padding)",
  scrollable = true,
}) => {
  return (
    <div 
      className="ws-admin-page" 
      style={{ 
        width: "100%",
        flex: 1,
        maxWidth: maxWidth ? maxWidth : "var(--ws-shell-max-width)",
        margin: "0 auto",
        padding,
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: scrollable ? "auto" : "hidden",
      }}
    >
      {children}
    </div>
  );
};

export default AdminPage;
