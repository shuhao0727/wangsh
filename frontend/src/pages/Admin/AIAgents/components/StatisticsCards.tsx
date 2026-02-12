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

const { Title, Text } = Typography;

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

  return (
    <Row gutter={[24, 24]} style={{ marginBottom: "24px" }}>
      <Col xs={24} sm={12} md={8} lg={6}>
        <Card
          styles={{
            body: { padding: "12px", width: "100%" },
          }}
          style={{
            borderLeft: "4px solid #1890ff",
            background: "#ffffff",
            height: "80px", // 高度减半
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
                {safeTotal}
              </Title>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                智能体总数
              </Text>
            </div>
            <RobotOutlined
              style={{ fontSize: "24px", color: "#1890ff", opacity: 0.3 }}
            />
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={6}>
        <Card
          styles={{
            body: { padding: "12px", width: "100%" },
          }}
          style={{
            borderLeft: "4px solid #52c41a",
            background: "#ffffff",
            height: "80px", // 高度减半
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
                {safeGeneralCount}
              </Title>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                通用智能体
              </Text>
            </div>
            <ThunderboltOutlined
              style={{ fontSize: "24px", color: "#52c41a", opacity: 0.3 }}
            />
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={6}>
        <Card
          styles={{
            body: { padding: "12px", width: "100%" },
          }}
          style={{
            borderLeft: "4px solid #722ed1",
            background: "#ffffff",
            height: "80px", // 高度减半
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
                {safeDifyCount}
              </Title>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Dify智能体
              </Text>
            </div>
            <CloudOutlined
              style={{ fontSize: "24px", color: "#722ed1", opacity: 0.3 }}
            />
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={6}>
        <Card
          styles={{
            body: { padding: "12px", width: "100%" },
          }}
          style={{
            borderLeft: "4px solid #fa8c16",
            background: "#ffffff",
            height: "80px", // 高度减半
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
                {safeActiveCount}
              </Title>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                启用中
              </Text>
            </div>
            <ApiOutlined
              style={{ fontSize: "24px", color: "#fa8c16", opacity: 0.3 }}
            />
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default StatisticsCards;
