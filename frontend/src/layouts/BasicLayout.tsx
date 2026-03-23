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
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";

const { Header, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

// 这些页面需要 overflow:hidden + flex-col（子页面自己处理滚动）
const FULL_HEIGHT_PATHS = [
  /^\/home(\/|$)/,
  /^\/ai-agents(\/|$)/,
  /^\/articles(\/|$)/,
  /^\/informatics(\/|$)/,
  /^\/it-technology(\/|$)/,
];

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
    isLoggedIn,
  } = useAuth();
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navVisibleMap, setNavVisibleMap] = useState<Record<string, boolean>>({});

  const isMobile = screens.md === false;
  const isFullHeight = FULL_HEIGHT_PATHS.some((re) => re.test(location.pathname));

  useEffect(() => {
    logger.debug("BasicLayout - 认证状态:", {
      isLoading, isAuthenticated, isLoggedIn: isLoggedIn(), user,
      token: getToken() ? "[exists]" : "[null]",
    });
  }, [isLoading, isAuthenticated, user, isLoggedIn, getToken]);

  useEffect(() => {
    logger.debug("BasicLayout - 登录模态框状态:", isLoginModalVisible);
  }, [isLoginModalVisible]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pairs = await Promise.all(
        NAV_VISIBILITY_ITEMS.map(async (it) => {
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
      for (const [path, visible] of pairs) next[path] = visible;
      setNavVisibleMap(next);
    })();
    return () => { mounted = false; };
  }, []);

  const navMenuItems = [
    { key: "/home",              icon: <HomeOutlined />,        label: "首页" },
    { key: "/ai-agents",        icon: <RobotOutlined />,       label: "AI智能体" },
    { key: "/informatics",      icon: <CodeOutlined />,        label: "信息学竞赛" },
    { key: "/it-technology",    icon: <LaptopOutlined />,      label: "信息技术" },
    { key: "/personal-programs",icon: <AppstoreOutlined />,    label: "个人程序" },
    { key: "/articles",         icon: <FileTextOutlined />,    label: "文章" },
  ].filter((it) => navVisibleMap[it.key] !== false);

  const handleMenuClick = ({ key }: { key: string }) => navigate(key);

  const handleLoginSuccess = () => {
    setIsLoginModalVisible(false);
    message.success("登录成功！");
    navigate(0);
  };

  return (
    <Layout className="basic-layout">
      <Header className="top-header">
        <div className="header-left">
          {/* Logo */}
          <div className="logo" onClick={() => navigate("/")}>
            <div className="logo-icon">W</div>
            {!isMobile && (
              <Title level={4} className="logo-text">WangSh</Title>
            )}
          </div>

          {/* 桌面端导航 */}
          {!isMobile && (
            <Menu
              mode="horizontal"
              selectedKeys={[location.pathname]}
              items={navMenuItems}
              onClick={handleMenuClick}
              className="horizontal-menu"
              overflowedIndicator={null}
            />
          )}
        </div>

        <div className="header-right">
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
            />
          )}
          <UserMenu onMenuClick={(key) => { if (key === "login") setIsLoginModalVisible(true); }} />
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
          className="border-none"
        />
      </Drawer>

      {/* 登录弹窗 */}
      <LoginForm
        visible={isLoginModalVisible}
        onClose={() => setIsLoginModalVisible(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* 内容区域 — 统一两种模式 */}
      <Content
        className="main-content"
        style={isFullHeight ? {
          padding: 0,
          margin: 0,
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        } : undefined}
      >
        <Outlet />
      </Content>
    </Layout>
  );
};

export default BasicLayout;
