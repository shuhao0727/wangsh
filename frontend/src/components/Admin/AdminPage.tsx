import React from "react";

type Props = {
  children: React.ReactNode;
  maxWidth?: number;
};

const AdminPage: React.FC<Props> = ({ children, maxWidth = 1400 }) => {
  return (
    <div className="ws-admin-page" style={{ maxWidth, margin: "0 auto" }}>
      {children}
    </div>
  );
};

export default AdminPage;
