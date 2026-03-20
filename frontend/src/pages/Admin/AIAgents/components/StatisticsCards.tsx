/**
 * 统计卡片组件
 */
import React from "react";
import { Row, Col, Typography } from "antd";
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

  const safeTotal = total ?? data.total_agents ?? 0;
  const safeGeneralCount = generalCount ?? 0;
  const safeDifyCount = difyCount ?? 0;
  const safeActiveCount = activeCount ?? data.active_agents ?? 0;

  const items = [
    {
      key: "total",
      label: "智能体总数",
      value: safeTotal,
      color: "#0EA5E9",
      bg: "rgba(14, 165, 233, 0.06)",
      icon: <RobotOutlined style={{ fontSize: 16, color: "#0EA5E9" }} />,
    },
    {
      key: "general",
      label: "通用智能体",
      value: safeGeneralCount,
      color: "#10B981",
      bg: "rgba(16, 185, 129, 0.06)",
      icon: <ThunderboltOutlined style={{ fontSize: 16, color: "#10B981" }} />,
    },
    {
      key: "dify",
      label: "Dify智能体",
      value: safeDifyCount,
      color: "#6366F1",
      bg: "rgba(99, 102, 241, 0.06)",
      icon: <CloudOutlined style={{ fontSize: 16, color: "#6366F1" }} />,
    },
    {
      key: "active",
      label: "启用中",
      value: safeActiveCount,
      color: "#F59E0B",
      bg: "rgba(245, 158, 11, 0.06)",
      icon: <ApiOutlined style={{ fontSize: 16, color: "#F59E0B" }} />,
    },
  ];

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {items.map((item) => (
        <Col key={item.key} xs={24} sm={12} md={8} lg={6}>
          <div
            style={{
              background: "#FAFAFA",
              borderRadius: 10,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
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
                style={{ fontSize: 12, lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {item.label}
              </Text>
            </div>
            <Text
              style={{ fontSize: 18, lineHeight: "22px", fontWeight: 600, color: "var(--ws-color-text)", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {item.value}
            </Text>
          </div>
        </Col>
      ))}
    </Row>
  );
};

export default StatisticsCards;
