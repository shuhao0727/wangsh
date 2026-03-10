import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { App, Layout, Menu, Typography, Drawer, Button, Grid } from "antd";
import {
  HomeOutlined,
  RobotOutlined,
  CodeOutlined,
  LaptopOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import "./BasicLayout.css";
import useAuth from "@hooks/useAuth";
import { LoginForm, UserMenu } from "@components/Auth";
import { logger } from "@services/logger";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const BasicLayout: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const {
    isLoading,
    isAuthenticated,
    user,
    getToken,
    logout,
    isLoggedIn,
  } = useAuth();
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isArticleDetailPage = /^\/articles\/[^/]+\/?$/.test(location.pathname);
  const isAIAgentsPage = /^\/ai-agents(\/|$)/.test(location.pathname);
  const isArticlesListPage = location.pathname === "/articles";
  const isInformaticsPage = /^\/informatics(\/|$)/.test(location.pathname);

  // Check if we are on a mobile screen (md and below)
  // screens.md is true for >= 768px. So !screens.md is mobile.
  // Note: screens might be empty on first render, so we default to true (desktop) to avoid flash
  const isMobile = screens.md === false;

  // 调试日志：显示认证状态
  useEffect(() => {
    logger.debug("BasicLayout - 认证状态:", {
      isLoading,
      isAuthenticated,
      isLoggedIn: isLoggedIn(),
      user,
      token: getToken() ? "有token" : "无token",
    });
  }, [isLoading, isAuthenticated, user, isLoggedIn, getToken]);

  // 调试日志：当登录模态框状态变化时
  useEffect(() => {
    logger.debug("BasicLayout - 登录模态框状态:", isLoginModalVisible);
  }, [isLoginModalVisible]);

  // 关闭移动端菜单当路由改变时
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // 导航菜单项 - 按您的需求设置
  const navMenuItems = [
    {
      key: "/home",
      icon: <HomeOutlined />,
      label: "首页",
    },
    {
      key: "/ai-agents",
      icon: <RobotOutlined />,
      label: "AI智能体",
    },
    {
      key: "/informatics",
      icon: <CodeOutlined />,
      label: "信息学竞赛",
    },
    {
      key: "/it-technology",
      icon: <LaptopOutlined />,
      label: "信息技术",
    },
    {
      key: "/personal-programs",
      icon: <AppstoreOutlined />,
      label: "个人程序",
    },
    {
      key: "/articles",
      icon: <FileTextOutlined />,
      label: "文章",
    },
  ];

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  // 处理登录成功
  const handleLoginSuccess = () => {
    setIsLoginModalVisible(false);
    message.success("登录成功！");
    // 登录后刷新页面以更新菜单和状态
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // 处理用户菜单点击
  const handleUserMenuClick = (key: string) => {
    if (key === "login") {
      setIsLoginModalVisible(true);
    } else if (key === "/ai-agents") {
      navigate("/ai-agents");
    } else if (key === "/home") {
      navigate("/home");
    } else if (key === "logout") {
      logout();
      navigate("/home");
    }
    // 其他菜单项的处理可以在这里添加
  };

  return (
    <Layout className="basic-layout">
      {/* 登录模态框 */}
      <LoginForm
        visible={isLoginModalVisible}
        onClose={() => setIsLoginModalVisible(false)}
        onSuccess={handleLoginSuccess}
        isAdmin={false}
        title="用户登录"
      />

      {/* 顶部导航栏 */}
      <Header className="top-header">
        <div className="header-left">
          {/* 移动端菜单按钮 */}
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
              className="mobile-menu-btn"
              style={{ marginRight: 8 }}
            />
          )}

          <div className="logo" onClick={() => navigate("/home")}>
            <div className="logo-icon">W</div>
            <Title level={4} className="logo-text">
              WangSh
            </Title>
          </div>

          {/* 桌面端：横向导航菜单 */}
          {!isMobile && (
            <Menu
              mode="horizontal"
              defaultSelectedKeys={[location.pathname]}
              selectedKeys={[location.pathname]}
              items={navMenuItems}
              onClick={handleMenuClick}
              className="horizontal-menu"
            />
          )}
        </div>

        {/* 右侧：用户信息 */}
        <div className="header-right">
          <UserMenu
            mode="avatar"
            showName={!isMobile}
            onMenuClick={handleUserMenuClick}
            style={{ cursor: "pointer" }}
          />
        </div>
      </Header>

      {/* 移动端侧边栏菜单 */}
      <Drawer
        title="导航菜单"
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        size="default"
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={navMenuItems}
          onClick={handleMenuClick}
          style={{ border: "none" }}
        />
      </Drawer>

      {/* 内容区域 */}
      <Content
        className="main-content"
        style={
          isAIAgentsPage
            ? {
                padding: "var(--ws-space-4)",
                margin: 0,
                height: "calc(100vh - var(--ws-header-height))",
                minHeight: 0,
                overflow: "hidden",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                width: "100%",
                position: "relative",
              }
            : isArticlesListPage
              ? {
                  padding: 0,
                  margin: 0,
                  height: "calc(100vh - var(--ws-header-height))",
                  minHeight: 0,
                  overflow: "hidden",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }
            : isInformaticsPage
              ? {
                  padding: 0,
                  margin: 0,
                  height: "calc(100vh - var(--ws-header-height))",
                  minHeight: 0,
                  overflow: "hidden",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }
            : isArticleDetailPage
              ? {
                  padding: 0,
                  margin: 0,
                  height: "calc(100vh - var(--ws-header-height))",
                  minHeight: 0,
                  overflow: "hidden",
                  boxSizing: "border-box",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                }
              : undefined
        }
      >
        <Outlet />
      </Content>
    </Layout>
  );
};

export default BasicLayout;
