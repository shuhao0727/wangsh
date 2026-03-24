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
  FormOutlined,
  ThunderboltOutlined,
  OrderedListOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import "./AdminLayout.css";
import useAuth from "@hooks/useAuth";
import useAppMeta from "@hooks/useAppMeta";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [form] = Form.useForm();
  const { version, envLabel } = useAppMeta();

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
        { key: "/admin/ai-agents",           icon: <RobotOutlined />,        label: "AI智能体管理" },
        { key: "/admin/users",               icon: <TeamOutlined />,         label: "用户管理" },
        { key: "/admin/agent-data",          icon: <DatabaseOutlined />,     label: "智能体数据" },
        { key: "/admin/group-discussion",    icon: <MonitorOutlined />,      label: "小组讨论" },
        { key: "/admin/assessment",          icon: <FormOutlined />,         label: "自适应测评" },
        { key: "/admin/classroom-interaction", icon: <ThunderboltOutlined />, label: "课堂互动" },
        { key: "/admin/classroom-plan",      icon: <OrderedListOutlined />,  label: "课堂计划" },
      ],
    },
    { key: "/admin/informatics",       icon: <CodeOutlined />,       label: "信息学竞赛" },
    { key: "/admin/it-technology",     icon: <LaptopOutlined />,     label: "信息技术" },
    { key: "/admin/personal-programs", icon: <AppstoreOutlined />,   label: "个人程序" },
    { key: "/admin/articles",          icon: <FileTextOutlined />,   label: "文章管理" },
    { key: "/admin/system",            icon: <SettingOutlined />,    label: "系统设置" },
  ];

  const handleMenuClick = ({ key }: { key: string }) => navigate(key);

  const getSelectedKeys = () => {
    const path = location.pathname;
    if (path === "/admin" || path === "/admin/") return ["/admin/dashboard"];
    if (path.startsWith("/admin/assessment")) return ["/admin/assessment"];
    return [path];
  };

  const getOpenKeys = () => {
    const path = location.pathname;
    const agentPaths = ["/admin/ai-agents", "/admin/users", "/admin/agent-data",
      "/admin/group-discussion", "/admin/assessment",
      "/admin/classroom-interaction", "/admin/classroom-plan"];
    if (agentPaths.some((p) => path.startsWith(p))) return ["/admin/agents"];
    return [];
  };

  const flattenMenuItems = (items: any[]): any[] => {
    const result: any[] = [];
    items.forEach((item) => {
      if (item.children) result.push(...item.children);
      else result.push(item);
    });
    return result;
  };

  const getCurrentTitle = () => {
    const flatItems = flattenMenuItems(adminMenuItems);
    return flatItems.find((item) => item.key === location.pathname)?.label || "管理后台";
  };

  const showLoginModal = () => setIsLoginModalVisible(true);

  const handleLogin = async (values: { username: string; password: string }) => {
    const res = await auth.login(values.username, values.password);
    if (!res.success) { message.error(res.error || "登录失败"); return; }
    const role = res.user?.role_code || "";
    const isAdminUser = role === "admin" || role === "super_admin";
    if (!isAdminUser) { message.error("当前账号不是管理员"); await auth.logout(); return; }
    message.success("登录成功");
    setIsLoginModalVisible(false);
    form.resetFields();
  };

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "管理员资料",
      onClick: () => navigate("/admin/users"),
    },
    { type: "divider" as const },
    {
      key: "home",
      icon: <HomeOutlined />,
      label: "返回首页",
      onClick: () => navigate("/"),
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      danger: true,
      onClick: async () => {
        await auth.logout();
        message.success("已退出登录");
        navigate("/");
      },
    },
  ];

  const roleLabel =
    auth.user?.role_code === "super_admin" ? "超级管理员" :
    auth.user?.role_code === "admin" ? "管理员" :
    auth.user?.role_code === "student" ? "学生用户" : "访客";

  return (
    <Layout className="admin-layout">
      <Modal
        title="管理员登录"
        open={isLoginModalVisible}
        onCancel={() => setIsLoginModalVisible(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} name="admin-login" onFinish={handleLogin} layout="vertical" autoComplete="off">
          <Form.Item label="管理员账号" name="username"
            rules={[{ required: true, message: "请输入管理员账号" }, { min: 3, message: "账号至少3个字符" }]}>
            <Input placeholder="请输入管理员账号" />
          </Form.Item>
          <Form.Item label="密码" name="password"
            rules={[{ required: true, message: "请输入密码" }, { min: 6, message: "密码至少6个字符" }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={auth.isLoading}>管理员登录</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 侧边栏 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        theme="light"
        width={220}
        style={{ height: "100vh", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100 }}
      >
        {/* Logo 区 */}
        <div className="flex items-center gap-3 px-4 py-5 select-none cursor-pointer"
          onClick={() => navigate("/admin/dashboard")}>
          <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)" }}>
            W
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-text-base">管理后台</span>
              {envLabel && (
                <span className="text-xs text-text-tertiary">{envLabel}</span>
              )}
            </div>
          )}
        </div>

        {/* 分割线 */}
        <div className="mx-4 mb-3 h-px bg-black/5" />

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={adminMenuItems}
          onClick={handleMenuClick}
          style={{ border: "none", background: "transparent", flex: 1 }}
        />

        {/* 底部：用户信息 + 折叠按钮 */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3 border-t border-black/5">
          {!collapsed ? (
            <div className="flex items-center gap-2 mb-2">
              <Avatar size="small" icon={<UserOutlined />}
                className="bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate text-text-base">
                  {auth.user?.full_name || auth.user?.username || "管理员"}
                </div>
                <div className="text-xs truncate text-text-tertiary">{roleLabel}</div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-2">
              <Avatar size="small" icon={<UserOutlined />}
                className="bg-primary" />
            </div>
          )}
          <Button
            type="text"
            block
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-text-secondary"
          >
            {!collapsed && "收起"}
          </Button>
        </div>
      </Sider>

      {/* 右侧主区域 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: "margin-left 0.2s", minHeight: "100vh" }}>
        {/* 顶部 Header */}
        <Header
          style={{
            position: "sticky", top: 0, zIndex: 99,
            background: "#FFFFFF", height: 56, lineHeight: "56px",
            padding: "0 24px", display: "flex", alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text-base">
              {getCurrentTitle()}
            </span>
            {version && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                v{version}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {auth.isLoggedIn() && auth.isAdmin() ? (
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={["click"]}>
                <div className="admin-user-menu flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-text-base">
                  <Avatar size="small" icon={<UserOutlined />}
                    className="bg-primary shrink-0" />
                  <span className="text-sm font-medium hidden sm:inline">
                    {auth.user?.full_name || auth.user?.username || "管理员"}
                  </span>
                </div>
              </Dropdown>
            ) : (
              <Button type="primary" size="small" onClick={showLoginModal}>管理员登录</Button>
            )}
          </div>
        </Header>

        {/* 内容区 */}
        <Content
          style={{
            margin: 0, padding: 0,
            height: "calc(100vh - 56px)",
            minHeight: 0,
            background: "transparent",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {auth.isLoggedIn() && auth.isAdmin() ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <Outlet />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-5xl text-text-tertiary">🔒</div>
              <Title level={3} className="!mb-1">需要管理员权限</Title>
              <Text type="secondary">只有管理员可以访问此页面</Text>
              <Button type="primary" size="large" onClick={showLoginModal} className="mt-2">管理员登录</Button>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
