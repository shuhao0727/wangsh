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
import "./Home.css";

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
      color: "var(--ws-color-primary)",
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
    <div className="home-page">
      {/* 欢迎横幅 */}
      <div
        className="home-banner"
      >
        <Title level={2} className="home-banner-title">
          <HomeOutlined /> 欢迎使用 WangSh 平台
        </Title>
        <Text className="home-banner-subtitle">
          集成了 AI 智能体、信息学竞赛、信息技术和个人程序的现代化平台
        </Text>
      </div>

      {/* 外部服务链接卡片 */}
      <Title level={3} className="home-section-title">
        <LinkOutlined /> 外部服务
      </Title>
      <Row gutter={[24, 24]} className="home-link-grid">
        {externalLinks.map((link, index) => (
          <Col xs={24} md={12} key={index}>
            <Card
              hoverable
              style={{
                borderLeft: `4px solid ${link.color}`,
              }}
              className="home-link-card"
              styles={{ body: { padding: "var(--ws-space-4)" } }}
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
              <div className="home-link-card-inner">
                <div
                  className="home-link-card-icon"
                  style={{
                    color: link.color,
                  }}
                >
                  {link.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <Title
                    level={4}
                    style={{ marginBottom: "var(--ws-space-1)", color: link.color }}
                  >
                    {link.title}
                  </Title>
                  <Text
                    type="secondary"
                    style={{ display: "block", marginBottom: "var(--ws-space-3)" }}
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
      <Title level={3} className="home-section-title">
        <ToolOutlined /> 平台功能
      </Title>
      <div className="home-module-grid">
        {platformModules.map((module, index) => (
          <div key={index} className="home-module-grid-item">
            <Card
              hoverable
              style={{
                borderTop: `4px solid ${module.color}`,
                background: "#ffffff",
                border: "1px solid #f0f0f0",
                boxShadow: "none",
                borderRadius: 8,
                transition: "all 0.3s ease",
              }}
              className="home-module-card"
              styles={{ body: { padding: "var(--ws-space-4) var(--ws-space-2)" } }}
              onClick={() => navigate(module.path)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)";
                e.currentTarget.style.borderColor = "transparent";
                // Keep border top color visible or let it be handled by CSS? 
                // Inline style overwrites class, so we need to be careful.
                // The borderTop is inline, so it stays. border-color transparent might hide it if not specific.
                // Let's use borderLeft/Right/Bottom transparent specifically if needed, or just let shadow do the work.
                // Actually, just setting box-shadow is enough for the effect.
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = "#f0f0f0";
              }}
            >
              <div
                className="home-module-icon"
                style={{
                  color: module.color,
                }}
              >
                {module.icon}
              </div>
              <Title
                level={4}
                style={{
                  marginBottom: "6px",
                  color: module.color,
                  fontSize: "var(--ws-text-md)",
                }}
              >
                {module.title}
              </Title>
              <Text
                type="secondary"
                style={{
                  display: "block",
                  marginBottom: 0,
                  fontSize: "var(--ws-text-xs)",
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
      <div className="home-footer">
        <Text>WangSh 平台 · 版本 {version} · {envLabel || "本地开发"}</Text>
      </div>
    </div>
  );
};

export default HomePage;
