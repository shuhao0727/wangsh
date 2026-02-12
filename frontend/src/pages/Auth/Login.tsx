import React, { useEffect, useMemo } from "react";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "@hooks/useAuth";

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirect = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const raw = sp.get("redirect") || "/admin/dashboard";
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/admin/dashboard";
  }, [location.search]);

  const requireAdmin = useMemo(() => redirect.startsWith("/admin"), [redirect]);

  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.isLoggedIn()) return;
    if (requireAdmin && !auth.isAdmin()) {
      message.warning("当前账号不是管理员，请使用管理员账号登录");
      auth.logout();
      return;
    }
    navigate(redirect, { replace: true });
  }, [auth, navigate, redirect, requireAdmin]);

  const onFinish = async (values: { username: string; password: string }) => {
    const res = await auth.login(values.username, values.password);
    if (!res.success) {
      message.error(res.error || "登录失败");
      return;
    }
    if (requireAdmin && !auth.isAdmin()) {
      message.warning("当前账号不是管理员，无法访问管理后台");
      await auth.logout();
      return;
    }
    message.success("登录成功");
    navigate(redirect, { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(180deg, var(--ws-color-surface-2) 0%, var(--ws-color-surface) 260px)",
      }}
    >
      <Card
        style={{
          width: 420,
          borderRadius: "var(--ws-radius-lg)",
          border: "1px solid var(--ws-color-border)",
        }}
        styles={{ body: { padding: 24 } }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            {requireAdmin ? "管理员登录" : "登录"}
          </Title>
          <Text type="secondary">
            {requireAdmin ? "仅管理员账号可进入后台" : "请输入账号密码继续"}
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            label={requireAdmin ? "管理员账号" : "用户名"}
            name="username"
            rules={[{ required: true, message: requireAdmin ? "请输入管理员账号" : "请输入用户名" }]}
          >
            <Input prefix={<UserOutlined />} placeholder={requireAdmin ? "请输入管理员账号" : "请输入用户名"} size="large" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 6, message: "密码至少6个字符" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={auth.isLoading}>
              {requireAdmin ? "管理员登录" : "登录"}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
