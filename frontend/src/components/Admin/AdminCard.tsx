import React from "react";
import { Card } from "antd";

type Props = React.ComponentProps<typeof Card>;

const AdminCard: React.FC<Props> = ({
  style,
  styles,
  ...rest
}) => {
  const mergedStyles = {
    ...(styles as any),
    header: {
      padding: "12px 24px",
      borderBottom: "none",
      background: "transparent",
      fontSize: 16,
      fontWeight: 600,
      ...(styles as any)?.header,
    },
    body: {
      padding: "24px",
      ...(styles as any)?.body,
    },
  };

  return (
    <Card
      bordered={false}
      {...rest}
      style={{
        background: "transparent",
        boxShadow: "none",
        borderBottom: "none",
        borderRadius: 0,
        ...style,
      }}
      styles={mergedStyles}
    />
  );
};

export default AdminCard;
