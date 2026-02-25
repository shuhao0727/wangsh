/**
 * 统计卡片组件
 * 展示智能体使用数据的核心统计信息
 */

import React from "react";
import { Card, Row, Col, Typography } from "antd";
import {
  BarChartOutlined,
  UserOutlined,
  RobotOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";

import type { StatisticsData } from "@services/znt/types";

const { Text } = Typography;

interface StatisticsCardsProps {
  data: StatisticsData;
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ data }) => {
  const { total_usage, active_students, active_agents, avg_response_time } =
    data;

  // 安全获取数值，如果undefined则返回0
  const safeTotalUsage = total_usage ?? 0;
  const safeActiveStudents = active_students ?? 0;
  const safeActiveAgents = active_agents ?? 0;
  const safeAvgResponseTime = avg_response_time ?? 0;

  // 格式化响应时间
  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const items = [
    {
      key: "total_usage",
      label: "总使用量",
      value: safeTotalUsage,
      color: "#1890ff",
      bg: "#e6f7ff",
      icon: <BarChartOutlined style={{ fontSize: 14, color: "#1890ff" }} />,
    },
    {
      key: "active_students",
      label: "活跃学生",
      value: safeActiveStudents,
      color: "#52c41a",
      bg: "#f6ffed",
      icon: <UserOutlined style={{ fontSize: 14, color: "#52c41a" }} />,
    },
    {
      key: "active_agents",
      label: "活跃智能体",
      value: safeActiveAgents,
      color: "#722ed1",
      bg: "#f9f0ff",
      icon: <RobotOutlined style={{ fontSize: 14, color: "#722ed1" }} />,
    },
    {
      key: "avg_response_time",
      label: "平均响应时间",
      value: formatResponseTime(safeAvgResponseTime),
      color: "#fa8c16",
      bg: "#fff7e6",
      icon: <ClockCircleOutlined style={{ fontSize: 14, color: "#fa8c16" }} />,
    },
  ];

  return (
    <div className="statistics-cards" style={{ marginBottom: "24px" }}>
      <Row gutter={[24, 24]}>
        {items.map((item) => (
          <Col key={item.key} xs={24} sm={12} md={8} lg={6}>
            <Card
              style={{
                borderLeft: `4px solid ${item.color}`,
                background: "#ffffff",
                height: 40,
                display: "flex",
                alignItems: "center",
              }}
              styles={{ body: { padding: 8, width: "100%" } }}
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
                      width: 22,
                      height: 22,
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
                    color: item.color,
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
    </div>
  );
};

export default StatisticsCards;
