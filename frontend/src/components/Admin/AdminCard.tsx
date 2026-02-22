import React from "react";
import { Card } from "antd";

type Props = React.ComponentProps<typeof Card>;

const AdminCard: React.FC<Props> = ({
  style,
  ...rest
}) => {
  return (
    <Card
      bordered={false}
      {...rest}
      style={{
        background: "transparent",
        boxShadow: "none",
        borderBottom: "none", // Remove subtle separator
        borderRadius: 0,
        ...style,
      }}
      styles={{
        header: {
          padding: "12px 24px",
          borderBottom: "none", // Remove header separator
          background: "transparent",
          fontSize: 16,
          fontWeight: 600,
        },
        body: {
          padding: "24px",
        }
      }}
    />
  );
};

export default AdminCard;
