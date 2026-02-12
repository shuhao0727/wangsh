import React from "react";
import { Card } from "antd";

type Props = React.ComponentProps<typeof Card> & {
  accentColor?: string;
  gradient?: string;
};

const AdminCard: React.FC<Props> = ({
  accentColor = "var(--ws-color-primary)",
  gradient = "var(--ws-color-surface)",
  style,
  ...rest
}) => {
  return (
    <Card
      {...rest}
      style={{
        borderLeft: `4px solid ${accentColor}`,
        background: gradient,
        ...style,
      }}
    />
  );
};

export default AdminCard;
