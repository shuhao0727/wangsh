import React from "react";
import { Card } from "antd";

type Props = {
  children: React.ReactNode;
  title?: React.ReactNode;
  extra?: React.ReactNode;
  bodyPadding?: number;
};

const PanelCard: React.FC<Props> = ({ children, title, extra, bodyPadding = 12 }) => {
  return (
    <Card
      className="informatics-card"
      title={title}
      extra={extra}
      styles={{ 
        body: { padding: bodyPadding },
        header: !title && !extra ? { display: 'none', borderBottom: 'none' } : undefined 
      }}
      bordered={false}
    >
      {children}
    </Card>
  );
};

export default PanelCard;

