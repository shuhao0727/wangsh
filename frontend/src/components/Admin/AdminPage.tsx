import React from "react";

type Props = {
  children: React.ReactNode;
  maxWidth?: number;
};

const AdminPage: React.FC<Props> = ({ children, maxWidth }) => {
  return (
    <div 
      className="ws-admin-page" 
      style={{ 
        width: "100%",
        maxWidth: maxWidth ? maxWidth : "1600px", // Increased max-width for "looser" layout
        margin: "0 auto",
        padding: "32px", // Increased global padding
        minHeight: "100%",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {children}
    </div>
  );
};

export default AdminPage;
