import React, { useEffect, useMemo, useState } from "react";
import { Card, Typography, Row, Col } from "antd";
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
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";
import "./Home.css";

const { Title, Text } = Typography;

const moduleColors: Record<string, { icon: string; bg: string }> = {
  "ai-agents":        { icon: "#0EA5E9", bg: "rgba(14, 165, 233, 0.08)" },
  "informatics":      { icon: "#6366F1", bg: "rgba(99, 102, 241, 0.08)" },
  "it-technology":    { icon: "#F59E0B", bg: "rgba(245, 158, 11, 0.08)" },
  "personal-programs":{ icon: "#10B981", bg: "rgba(16, 185, 129, 0.08)" },
  "articles":         { icon: "#06B6D4", bg: "rgba(6, 182, 212, 0.08)" },
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { version, envLabel } = useAppMeta();
  const [navVisibleMap, setNavVisibleMap] = useState<Record<string, boolean>>({});
  const externalLinks = [
    {
      title: "Dify AI 平台",
      description: "AI 智能体开发与部署平台",
      url: config.difyUrl,
      icon: <RocketOutlined />,
    },
    {
      title: "NAS 文件服务",
      description: "网络附加存储与文件管理",
      url: config.nasUrl,
      icon: <DatabaseOutlined />,
    },
  ];

  const platformModules = [
    {
      id: "ai-agents",
      title: "AI 智能体",
      description: "智能对话与文档分析",
      icon: <RocketOutlined />,
      path: "/ai-agents",
    },
    {
      id: "informatics",
      title: "信息学竞赛",
      description: "算法题库与竞赛指导",
      icon: <BookOutlined />,
      path: "/informatics",
    },
    {
      id: "it-technology",
      title: "信息技术",
      description: "编程技术与系统架构",
      icon: <ToolOutlined />,
      path: "/it-technology",
    },
    {
      id: "personal-programs",
      title: "个人程序",
      description: "实用工具与小应用",
      icon: <CloudOutlined />,
      path: "/personal-programs",
    },
    {
      id: "articles",
      title: "文章",
      description: "技术博客与学习笔记",
      icon: <FileTextOutlined />,
      path: "/articles",
    },
  ];

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pairs = await Promise.all(
        NAV_VISIBILITY_ITEMS.filter((it) => it.showOnHome).map(async (it) => {
          try {
            const res = await featureFlagsApi.getPublic(it.flagKey);
            return [it.path, res?.value?.enabled !== false] as const;
          } catch {
            return [it.path, true] as const;
          }
        }),
      );
      if (!mounted) return;
      const next: Record<string, boolean> = {};
      for (const [path, visible] of pairs) {
        next[path] = visible;
      }
      setNavVisibleMap(next);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleModules = useMemo(
    () => platformModules.filter((module) => navVisibleMap[module.path] !== false),
    [platformModules, navVisibleMap],
  );

  return (
    <div className="home-page">
      {/* 欢迎横幅 */}
      <div className="home-banner">
        <Title level={2} className="home-banner-title">
          <HomeOutlined style={{ marginRight: 8 }} />
          欢迎使用 WangSh 平台
        </Title>
        <Text className="home-banner-subtitle">
          集成了 AI 智能体、信息学竞赛、信息技术和个人程序的现代化教育平台
        </Text>
      </div>

      {/* 平台功能模块 */}
      <Title level={4} className="home-section-title">
        <ToolOutlined /> 平台功能
      </Title>
      <div className="home-module-grid">
        {visibleModules.map((module, index) => {
          const colors = moduleColors[module.id] || { icon: "#0EA5E9", bg: "rgba(14, 165, 233, 0.08)" };
          return (
            <div key={index} className="home-module-grid-item">
              <Card
                hoverable
                className="home-module-card"
                data-module={module.id}
                onClick={() => navigate(module.path)}
              >
                <div
                  className="home-module-icon-wrap"
                  style={{ background: colors.bg, color: colors.icon }}
                >
                  {module.icon}
                </div>
                <Title
                  level={5}
                  style={{ marginBottom: 4, color: "var(--ws-color-text)", fontSize: "var(--ws-text-md)" }}
                >
                  {module.title}
                </Title>
                <Text
                  type="secondary"
                  style={{ display: "block", fontSize: "var(--ws-text-xs)", lineHeight: "1.5" }}
                >
                  {module.description}
                </Text>
              </Card>
            </div>
          );
        })}
      </div>

      {/* 外部服务链接 */}
      <Title level={4} className="home-section-title">
        <LinkOutlined /> 外部服务
      </Title>
      <Row gutter={[16, 16]} className="home-link-grid">
        {externalLinks.map((link, index) => (
          <Col xs={24} md={12} key={index}>
            <Card
              hoverable
              className="home-link-card"
              styles={{ body: { padding: "var(--ws-space-3)" } }}
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
            >
              <div className="home-link-card-inner">
                <div className="home-link-card-icon">
                  {link.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <Title level={5} style={{ marginBottom: 2, color: "var(--ws-color-text)" }}>
                    {link.title}
                  </Title>
                  <Text type="secondary" style={{ fontSize: "var(--ws-text-xs)" }}>
                    {link.description}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 底部信息 */}
      <div className="home-footer">
        <Text>WangSh 平台 · 版本 {version} · {envLabel || "本地开发"}</Text>
      </div>
    </div>
  );
};

export default HomePage;
