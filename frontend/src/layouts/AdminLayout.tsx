import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  message,
  Divider,
} from "antd";
import {
  DashboardOutlined,
  RobotOutlined,
  DatabaseOutlined,
  CodeOutlined,
  LaptopOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  HomeOutlined,
  MonitorOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import "./AdminLayout.css";
import useAuth from "@hooks/useAuth";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // Directly use default values as we wrap with ConfigProvider in App
  const colorBgContainer = "#ffffff";

  // Manage menu items
  const adminMenuItems = [
    {
      key: "/admin/dashboard",
      icon: <DashboardOutlined />,
      label: "状态概览",
    },
    {
      key: "/admin/agents",
      icon: <RobotOutlined />,
      label: "智能体",
      children: [
        {
          key: "/admin/ai-agents",
          icon: <RobotOutlined />,
          label: "AI智能体管理",
        },
        {
          key: "/admin/users",
          icon: <TeamOutlined />,
          label: "用户管理",
        },
        {
          key: "/admin/agent-data",
          icon: <DatabaseOutlined />,
          label: "智能体数据",
        },
        {
          key: "/admin/group-discussion",
          icon: <TeamOutlined />,
          label: "小组讨论",
        },
      ],
    },
    {
      key: "/admin/informatics",
      icon: <CodeOutlined />,
      label: "信息学竞赛",
    },
    {
      key: "/admin/it-technology",
      icon: <LaptopOutlined />,
      label: "信息技术",
    },
    {
      key: "/admin/personal-programs",
      icon: <AppstoreOutlined />,
      label: "个人程序",
    },
    {
      key: "/admin/articles",
      icon: <FileTextOutlined />,
      label: "文章管理",
    },
    {
      key: "/admin/system",
      icon: <SettingOutlined />,
      label: "系统设置",
    },
  ];

  // Handle menu click
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  // Get current selected keys (supports nested menus)
  const getSelectedKeys = () => {
    const path = location.pathname;
    // If root /admin, default to dashboard
    if (path === "/admin" || path === "/admin/") {
      return ["/admin/dashboard"];
    }
    return [path];
  };

  // Get current open keys (for nested menus)
  const getOpenKeys = () => {
    const path = location.pathname;
    // If current path is agent related, open agents menu
    if (
      path.startsWith("/admin/ai-agents") ||
      path.startsWith("/admin/users") ||
      path.startsWith("/admin/agent-data") ||
      path.startsWith("/admin/group-discussion")
    ) {
      return ["/admin/agents"];
    }
    return [];
  };

  // Flatten menu items for title lookup
  const flattenMenuItems = (items: any[]): any[] => {
    const result: any[] = [];
    items.forEach((item) => {
      if (item.children) {
        result.push(...item.children);
      } else {
        result.push(item);
      }
    });
    return result;
  };

  // Get current page title
  const getCurrentTitle = () => {
    const path = location.pathname;
    // Flatten menu items for lookup
    const flatItems = flattenMenuItems(adminMenuItems);
    const item = flatItems.find((item) => item.key === path);

    if (item) {
      return item.label;
    }

    // Default title if not found
    return "管理后台";
  };

  // User dropdown menu
  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "管理员资料",
      onClick: () => {
        message.info("管理员资料功能开发中...");
      },
    },
    {
      key: "back-to-home",
      icon: <HomeOutlined />,
      label: "返回网站首页",
      onClick: () => {
        navigate("/home");
      },
    },
    {
      key: "divider",
      type: "divider" as const,
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: () => {
        auth.logout();
        navigate("/home");
      },
    },
  ];

  // Handle login submit
  const handleLogin = async (values: {
    username: string;
    password: string;
  }) => {
    try {
      const result = await auth.login(values.username, values.password);
      if (result.success) {
        message.success("登录成功！");
        setIsLoginModalVisible(false);
        form.resetFields();
        // Check if admin
        if (auth.isSuperAdmin()) {
          navigate("/admin/dashboard");
        }
      } else {
        message.error(result.error || "登录失败");
      }
    } catch (error) {
      message.error("登录过程中发生错误");
    }
  };

  // Open login modal
  const showLoginModal = () => {
    setIsLoginModalVisible(true);
  };

  // Close login modal
  const closeLoginModal = () => {
    setIsLoginModalVisible(false);
    form.resetFields();
  };

  // Show loading if loading
  if (auth.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Title level={4}>加载管理员面板...</Title>
        <Text type="secondary">请稍候...</Text>
      </div>
    );
  }

  return (
    <Layout className="admin-layout">
      {/* Login Modal */}
      <Modal
        title="管理员登录"
        open={isLoginModalVisible}
        onCancel={closeLoginModal}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={form}
          name="admin-login"
          onFinish={handleLogin}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="管理员账号"
            name="username"
            rules={[
              { required: true, message: "请输入管理员账号" },
              { min: 3, message: "账号至少3个字符" },
            ]}
          >
            <Input placeholder="请输入管理员账号" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 6, message: "密码至少6个字符" },
            ]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={auth.isLoading}
            >
              管理员登录
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Sidebar */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={240}
        style={{
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          borderRight: "none", // Remove divider
        }}
      >
        {/* Sidebar Header */}
        <div className="admin-sidebar-header" style={{ padding: "24px 16px" }}>
          <div className="admin-logo" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="admin-logo-icon" style={{ 
              width: 32, height: 32, background: "#3498db", borderRadius: 6, 
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" 
            }}>WS</div>
            {!collapsed && (
              <div className="admin-logo-text">
                <Title level={5} style={{ margin: 0, color: "#2c3e50", fontSize: 16, fontWeight: 600 }}>
                  管理后台
                </Title>
              </div>
            )}
          </div>
        </div>

        <Divider style={{ margin: "8px 0" }} />

        {/* User Info Area */}
        <div className="admin-user-info">
          <Avatar
            size={collapsed ? "default" : "large"}
            icon={<UserOutlined />}
            style={{ backgroundColor: "#3498db" }}
          />
          {!collapsed && (
            <div className="admin-user-details">
              <Text strong>
                {auth.user?.full_name || auth.user?.username || "管理员"}
              </Text>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {auth.user?.role_code === "super_admin"
                  ? "超级管理员"
                  : auth.user?.role_code === "admin"
                    ? "管理员"
                    : auth.user?.role_code === "student"
                      ? "学生用户"
                      : "访客"}
              </Text>
            </div>
          )}
        </div>

        <Divider style={{ margin: "8px 0" }} />

        {/* Menu */}
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={adminMenuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />

        {/* Sidebar Footer */}
        {!collapsed && (
          <div className="admin-sidebar-footer">
            <Text type="secondary" style={{ fontSize: "12px" }}>
              WangSh Admin v1.0.0
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: "10px" }}>
              © 2026 WangSh Team
            </Text>
          </div>
        )}
      </Sider>

      {/* Right Content Area */}
      <Layout
        style={{
          marginLeft: collapsed ? 80 : 240,
          transition: "margin-left 0.2s",
          minHeight: "100vh",
          background: "#ffffff", // Ensure white background
        }}
      >
        {/* Header */}
        <Header
          style={{
            padding: "0 24px",
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 99,
            borderBottom: "none", // Remove divider
            height: 64, // Explicit height
          }}
        >
          <div className="admin-header-left">
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
              {getCurrentTitle()}
            </Title>
          </div>

          <div className="admin-header-right">
            {!auth.isLoggedIn() ? (
              <Button
                type="primary"
                icon={<UserOutlined />}
                onClick={showLoginModal}
              >
                管理员登录
              </Button>
            ) : (
              <div
                style={{ display: "flex", alignItems: "center", gap: "16px" }}
              >
                <Button
                  type="text"
                  icon={<MonitorOutlined />}
                  onClick={() => navigate("/admin/dashboard")}
                >
                  系统监控
                </Button>

                <Dropdown
                  menu={{ items: userMenuItems }}
                  placement="bottomRight"
                  arrow
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <Avatar
                      size="default"
                      icon={<UserOutlined />}
                      style={{ marginRight: 8, backgroundColor: "#3498db" }}
                    />
                    <Text strong>{auth.user?.username || "管理员"}</Text>
                  </div>
                </Dropdown>
              </div>
            )}
          </div>
        </Header>

        {/* Main Content Area */}
        <Content
          style={{
            margin: 0,
            padding: 0, // Removed padding globally for "canvas" feel
            minHeight: "calc(100vh - 64px)", // Full height minus header
            background: "transparent",
            overflow: "hidden", // Let children handle scroll
            display: "flex",
            flexDirection: "column",
          }}
        >
          {auth.isLoggedIn() && auth.isAdmin() ? (
            <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
                <Outlet />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "80px 24px" }}>
              <Title level={3}>需要管理员权限</Title>
              <Text
                type="secondary"
                style={{ marginBottom: "24px", display: "block" }}
              >
                只有管理员可以访问此页面
              </Text>
              <Button type="primary" size="large" onClick={showLoginModal}>
                管理员登录
              </Button>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
