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

const { Title, Text } = Typography;

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

  return (
    <div className="statistics-cards" style={{ marginBottom: "24px" }}>
      <Row gutter={[24, 24]}>
        {/* 总使用量 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            style={{
              borderLeft: "4px solid #1890ff",
              background: "#ffffff",
              height: "80px",
              display: "flex",
              alignItems: "center",
            }}
            styles={{ body: { padding: "12px", width: "100%" } }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div>
                <Title
                  level={4}
                  style={{
                    marginBottom: "4px",
                    color: "#1890ff",
                    fontSize: "20px",
                  }}
                >
                  {safeTotalUsage}
                </Title>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  总使用量
                </Text>
              </div>
              <BarChartOutlined
                style={{ fontSize: "24px", color: "#1890ff", opacity: 0.3 }}
              />
            </div>
          </Card>
        </Col>

        {/* 活跃学生 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            style={{
              borderLeft: "4px solid #52c41a",
              background: "#ffffff",
              height: "80px",
              display: "flex",
              alignItems: "center",
            }}
            styles={{ body: { padding: "12px", width: "100%" } }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div>
                <Title
                  level={4}
                  style={{
                    marginBottom: "4px",
                    color: "#52c41a",
                    fontSize: "20px",
                  }}
                >
                  {safeActiveStudents}
                </Title>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  活跃学生
                </Text>
              </div>
              <UserOutlined
                style={{ fontSize: "24px", color: "#52c41a", opacity: 0.3 }}
              />
            </div>
          </Card>
        </Col>

        {/* 活跃智能体 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            style={{
              borderLeft: "4px solid #722ed1",
              background: "#ffffff",
              height: "80px",
              display: "flex",
              alignItems: "center",
            }}
            styles={{ body: { padding: "12px", width: "100%" } }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div>
                <Title
                  level={4}
                  style={{
                    marginBottom: "4px",
                    color: "#722ed1",
                    fontSize: "20px",
                  }}
                >
                  {safeActiveAgents}
                </Title>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  活跃智能体
                </Text>
              </div>
              <RobotOutlined
                style={{ fontSize: "24px", color: "#722ed1", opacity: 0.3 }}
              />
            </div>
          </Card>
        </Col>

        {/* 平均响应时间 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            style={{
              borderLeft: "4px solid #fa8c16",
              background: "#ffffff",
              height: "80px",
              display: "flex",
              alignItems: "center",
            }}
            styles={{ body: { padding: "12px", width: "100%" } }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div>
                <Title
                  level={4}
                  style={{
                    marginBottom: "4px",
                    color: "#fa8c16",
                    fontSize: "20px",
                  }}
                >
                  {formatResponseTime(safeAvgResponseTime)}
                </Title>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  平均响应时间
                </Text>
              </div>
              <ClockCircleOutlined
                style={{ fontSize: "24px", color: "#fa8c16", opacity: 0.3 }}
              />
            </div>
          </Card>
        </Col>

      </Row>
    </div>
  );
};

export default StatisticsCards;
