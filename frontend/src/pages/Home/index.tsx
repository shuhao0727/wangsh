import React from "react";
import { Card, Typography, Row, Col, Divider } from "antd";
import {
  HomeOutlined,
  LinkOutlined,
  CloudOutlined,
  DatabaseOutlined,
  RocketOutlined,
  ToolOutlined,
  BookOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { config } from "@services";
import useAppMeta from "@hooks/useAppMeta";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { version, envLabel } = useAppMeta();
  const externalLinks = [
    {
      title: "Dify AI 平台",
      description: "AI 智能体开发与部署平台",
      url: config.difyUrl,
      icon: <RocketOutlined />,
      color: "var(--ws-color-primary)",
    },
    {
      title: "NAS 文件服务",
      description: "网络附加存储与文件管理",
      url: config.nasUrl,
      icon: <DatabaseOutlined />,
      color: "var(--ws-color-success)",
    },
  ];

  const platformModules = [
    {
      title: "AI 智能体",
      description: "智能对话与文档分析",
      icon: <RocketOutlined />,
      color: "var(--ws-color-primary)",
      path: "/ai-agents",
    },
    {
      title: "信息学竞赛",
      description: "算法题库与竞赛指导",
      icon: <BookOutlined />,
      color: "var(--ws-color-info)",
      path: "/informatics",
    },
    {
      title: "信息技术",
      description: "编程技术与系统架构",
      icon: <ToolOutlined />,
      color: "var(--ws-color-warning)",
      path: "/it-technology",
    },
    {
      title: "个人程序",
      description: "实用工具与小应用",
      icon: <CloudOutlined />,
      color: "var(--ws-color-success)",
      path: "/personal-programs",
    },
    {
      title: "文章",
      description: "技术博客与学习笔记",
      icon: <FileTextOutlined />,
      color: "var(--ws-color-accent)",
      path: "/articles",
    },
  ];

  return (
    <div className="home-page" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* 欢迎横幅 */}
      <div
        style={{
          textAlign: "center",
          padding: "20px 20px 15px",
          background: "#ffffff",
          borderRadius: "12px",
          marginBottom: "40px",
        }}
      >
        <Title level={2} style={{ color: "var(--ws-color-primary)", marginBottom: "8px" }}>
          <HomeOutlined /> 欢迎使用 WangSh 平台
        </Title>
        <Text style={{ fontSize: "14px", color: "var(--ws-color-text-secondary)" }}>
          集成了 AI 智能体、信息学竞赛、信息技术和个人程序的现代化平台
        </Text>
      </div>

      {/* 外部服务链接卡片 */}
      <Title level={3} style={{ marginBottom: "24px", color: "var(--ws-color-primary)" }}>
        <LinkOutlined /> 外部服务
      </Title>
      <Row gutter={[24, 24]} style={{ marginBottom: "40px" }}>
        {externalLinks.map((link, index) => (
          <Col xs={24} md={12} key={index}>
            <Card
              hoverable
              style={{
                borderLeft: `4px solid ${link.color}`,
                height: "100%",
                transition: "transform 0.3s, box-shadow 0.3s",
                cursor: "pointer",
              }}
              styles={{ body: { padding: "24px" } }}
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "none";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "32px",
                    color: link.color,
                    flexShrink: 0,
                  }}
                >
                  {link.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <Title
                    level={4}
                    style={{ marginBottom: "8px", color: link.color }}
                  >
                    {link.title}
                  </Title>
                  <Text
                    type="secondary"
                    style={{ display: "block", marginBottom: "16px" }}
                  >
                    {link.description}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider />

      {/* 平台功能模块 */}
      <Title level={3} style={{ marginBottom: "24px", color: "var(--ws-color-primary)" }}>
        <ToolOutlined /> 平台功能
      </Title>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          marginBottom: "40px",
          justifyContent: "space-between",
        }}
      >
        {platformModules.map((module, index) => (
          <div
            key={index}
            style={{
              flex: "1 1 calc(20% - 20px)",
              minWidth: "180px",
              maxWidth: "220px",
            }}
          >
            <Card
              hoverable
              style={{
                textAlign: "center",
                borderTop: `4px solid ${module.color}`,
                height: "100%",
                width: "100%",
                cursor: "pointer",
                minHeight: 150,
              }}
              styles={{ body: { padding: "20px 12px" } }}
              onClick={() => navigate(module.path)}
            >
              <div
                style={{
                  fontSize: "32px",
                  color: module.color,
                  marginBottom: "12px",
                }}
              >
                {module.icon}
              </div>
              <Title
                level={4}
                style={{
                  marginBottom: "6px",
                  color: module.color,
                  fontSize: "16px",
                }}
              >
                {module.title}
              </Title>
              <Text
                type="secondary"
                style={{
                  display: "block",
                  marginBottom: 0,
                  fontSize: "12px",
                  lineHeight: "1.4",
                }}
              >
                {module.description}
              </Text>
            </Card>
          </div>
        ))}
      </div>

      {/* 底部信息 */}
      <div
        style={{
          textAlign: "center",
          marginTop: "40px",
          padding: "24px",
          borderTop: "1px solid var(--ws-color-border)",
          color: "var(--ws-color-text-secondary)",
        }}
      >
        <Text>WangSh 平台 · 版本 {version} · {envLabel || "本地开发"}</Text>
      </div>
    </div>
  );
};

export default HomePage;
