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
  
  // 直接使用默认值，因为我们会在App中使用ConfigProvider包装
  const colorBgContainer = "#ffffff";
  const borderRadiusLG = 8;

  // 管理菜单项
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

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  // 获取当前选中的菜单项（支持嵌套菜单）
  const getSelectedKeys = () => {
    const path = location.pathname;
    // 如果是/admin根路径，默认选中dashboard
    if (path === "/admin" || path === "/admin/") {
      return ["/admin/dashboard"];
    }
    return [path];
  };

  // 获取当前展开的菜单项（用于嵌套菜单）
  const getOpenKeys = () => {
    const path = location.pathname;
    // 如果当前路径是智能体相关页面，展开智能体菜单
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

  // 扁平化菜单项，用于标题查找
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

  // 获取当前页面标题
  const getCurrentTitle = () => {
    const path = location.pathname;
    // 扁平化菜单项进行查找
    const flatItems = flattenMenuItems(adminMenuItems);
    const item = flatItems.find((item) => item.key === path);

    if (item) {
      return item.label;
    }

    // 如果找不到，返回默认标题
    return "管理后台";
  };

  // 用户下拉菜单
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

  // 处理登录提交
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
        // 检查是否为管理员
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

  // 打开登录模态框
  const showLoginModal = () => {
    setIsLoginModalVisible(true);
  };

  // 关闭登录模态框
  const closeLoginModal = () => {
    setIsLoginModalVisible(false);
    form.resetFields();
  };

  // 如果正在加载，显示加载中
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
      {/* 登录模态框 */}
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

      {/* 左侧导航栏 */}
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
          boxShadow: "2px 0 8px 0 rgba(29, 35, 41, 0.05)",
        }}
      >
        {/* 左侧边栏头部 */}
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <div className="admin-logo-icon">WS</div>
            {!collapsed && (
              <div className="admin-logo-text">
                <Title level={5} style={{ margin: 0, color: "#1890ff" }}>
                  管理后台
                </Title>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  WangSh Admin
                </Text>
              </div>
            )}
          </div>
        </div>

        <Divider style={{ margin: "8px 0" }} />

        {/* 用户信息区域 */}
        <div className="admin-user-info">
          <Avatar
            size={collapsed ? "default" : "large"}
            icon={<UserOutlined />}
            style={{ backgroundColor: "#1890ff" }}
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

        {/* 管理菜单 */}
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={adminMenuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />

        {/* 左侧边栏底部 */}
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

      {/* 右侧内容区域 */}
      <Layout
        style={{
          marginLeft: collapsed ? 80 : 240,
          transition: "margin-left 0.2s",
          minHeight: "100vh",
        }}
      >
        {/* 顶部栏 */}
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
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
          }}
        >
          <div className="admin-header-left">
            <Title level={4} style={{ margin: 0 }}>
              {getCurrentTitle()}
            </Title>
          </div>

          <div className="admin-header-right">
            {/* 如果用户未登录，显示登录按钮 */}
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
                {/* 系统监控 */}
                <Button
                  type="text"
                  icon={<MonitorOutlined />}
                  onClick={() => navigate("/admin/dashboard")}
                >
                  系统监控
                </Button>

                {/* 用户信息 */}
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
                      style={{ marginRight: 8, backgroundColor: "#1890ff" }}
                    />
                    <Text strong>{auth.user?.username || "管理员"}</Text>
                  </div>
                </Dropdown>
              </div>
            )}
          </div>
        </Header>

        {/* 主要内容区域 */}
        <Content
          style={{
            margin: "24px 16px",
            padding: 0,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {auth.isLoggedIn() && auth.isAdmin() ? (
            <Outlet />
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
