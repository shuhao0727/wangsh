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
            borderLeft: "none",
            borderTop: "4px solid #1890ff",
            background: "#ffffff",
            height: "100px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start", // Left align content
              gap: "12px", // Reduced gap
              width: "100%",
            }}
          >
             <div style={{ 
              width: 40, // Smaller icon container
              height: 40, 
              borderRadius: "50%", 
              background: "#e6f7ff", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              flexShrink: 0
            }}>
              <RobotOutlined
                style={{ fontSize: "20px", color: "#1890ff" }} // Smaller icon
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                智能体总数
              </Text>
              <Title
                level={2}
                style={{
                  margin: "0",
                  color: "#2c3e50",
                  fontWeight: 600,
                  fontSize: "24px", // Slightly smaller number
                  lineHeight: 1
                }}
              >
                {safeTotal}
              </Title>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={6}>
        <Card
          styles={{
            body: { padding: "16px", width: "100%" },
          }}
          style={{
            borderLeft: "none",
            borderTop: "4px solid #52c41a",
            background: "#ffffff",
            height: "100px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "12px",
              width: "100%",
            }}
          >
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: "50%", 
              background: "#f6ffed", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              flexShrink: 0
            }}>
              <ThunderboltOutlined
                style={{ fontSize: "20px", color: "#52c41a" }}
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                通用智能体
              </Text>
              <Title
                level={2}
                style={{
                  margin: "0",
                  color: "#2c3e50",
                  fontWeight: 600,
                  fontSize: "24px",
                  lineHeight: 1
                }}
              >
                {safeGeneralCount}
              </Title>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={6}>
        <Card
          styles={{
            body: { padding: "16px", width: "100%" },
          }}
          style={{
            borderLeft: "none",
            borderTop: "4px solid #722ed1",
            background: "#ffffff",
            height: "100px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "12px",
              width: "100%",
            }}
          >
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: "50%", 
              background: "#f9f0ff", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              flexShrink: 0
            }}>
              <CloudOutlined
                style={{ fontSize: "20px", color: "#722ed1" }}
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Dify智能体
              </Text>
              <Title
                level={2}
                style={{
                  margin: "0",
                  color: "#2c3e50",
                  fontWeight: 600,
                  fontSize: "24px",
                  lineHeight: 1
                }}
              >
                {safeDifyCount}
              </Title>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={6}>
        <Card
          styles={{
            body: { padding: "16px", width: "100%" },
          }}
          style={{
            borderLeft: "none",
            borderTop: "4px solid #fa8c16",
            background: "#ffffff",
            height: "100px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "12px",
              width: "100%",
            }}
          >
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: "50%", 
              background: "#fff7e6", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              flexShrink: 0
            }}>
              <ApiOutlined
                style={{ fontSize: "20px", color: "#fa8c16" }}
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                启用中
              </Text>
              <Title
                level={2}
                style={{
                  margin: "0",
                  color: "#2c3e50",
                  fontWeight: 600,
                  fontSize: "24px",
                  lineHeight: 1
                }}
              >
                {safeActiveCount}
              </Title>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default StatisticsCards;
