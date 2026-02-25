/**
 * 统计卡片组件
 */
import React from "react";
import { Card, Row, Col, Typography } from "antd";
import {
  RobotOutlined,
  ThunderboltOutlined,
  CloudOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import { AgentStatisticsData } from "@services/znt/types";

const { Text } = Typography;

interface StatisticsCardsProps {
  data: AgentStatisticsData;
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ data }) => {
  const { total, generalCount, difyCount, activeCount } = data;

  // 安全获取数值，如果undefined则返回0
  const safeTotal = total ?? data.total_agents ?? 0;
  const safeGeneralCount = generalCount ?? 0;
  const safeDifyCount = difyCount ?? 0;
  const safeActiveCount = activeCount ?? data.active_agents ?? 0;

  const items = [
    {
      key: "total",
      label: "智能体总数",
      value: safeTotal,
      color: "#1890ff",
      bg: "#e6f7ff",
      icon: <RobotOutlined style={{ fontSize: 16, color: "#1890ff" }} />,
    },
    {
      key: "general",
      label: "通用智能体",
      value: safeGeneralCount,
      color: "#52c41a",
      bg: "#f6ffed",
      icon: <ThunderboltOutlined style={{ fontSize: 16, color: "#52c41a" }} />,
    },
    {
      key: "dify",
      label: "Dify智能体",
      value: safeDifyCount,
      color: "#722ed1",
      bg: "#f9f0ff",
      icon: <CloudOutlined style={{ fontSize: 16, color: "#722ed1" }} />,
    },
    {
      key: "active",
      label: "启用中",
      value: safeActiveCount,
      color: "#fa8c16",
      bg: "#fff7e6",
      icon: <ApiOutlined style={{ fontSize: 16, color: "#fa8c16" }} />,
    },
  ];

  return (
    <Row gutter={[24, 16]} style={{ marginBottom: 16 }}>
      {items.map((item) => (
        <Col key={item.key} xs={24} sm={12} md={8} lg={6}>
          <Card
            styles={{
              body: { padding: 8, width: "100%" },
            }}
            style={{
              borderLeft: "none",
              borderTop: `4px solid ${item.color}`,
              background: "#ffffff",
              height: 40,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: item.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 12,
                    lineHeight: "16px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.label}
                </Text>
              </div>
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: "22px",
                  fontWeight: 600,
                  color: "#2c3e50",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {item.value}
              </Text>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default StatisticsCards;
