import React, { useEffect, useMemo } from "react";
import { Button, Form, Input, message } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "@hooks/useAuth";

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
    const role = res.user?.role_code || "";
    const isAdminUser = role === "admin" || role === "super_admin";
    if (requireAdmin && !isAdminUser) {
      message.warning("当前账号不是管理员，无法访问管理后台");
      await auth.logout();
      return;
    }
    message.success("登录成功");
    navigate(redirect, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ede9fe 100%)" }}>

      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo 区 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 text-white text-2xl font-bold shadow-lg"
            style={{ background: "linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)" }}>
            W
          </div>
          <div className="text-2xl font-bold tracking-tight text-text-base">
            {requireAdmin ? "管理员登录" : "登录"}
          </div>
          <div className="text-sm mt-1 text-text-secondary">
            {requireAdmin ? "仅管理员账号可进入后台" : "请输入账号密码继续"}
          </div>
        </div>

        {/* 表单卡片 */}
        <div className="rounded-2xl p-8 shadow-sm"
          style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)" }}>
          <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              label={requireAdmin ? "管理员账号" : "用户名"}
              name="username"
              rules={[{ required: true, message: requireAdmin ? "请输入管理员账号" : "请输入用户名" }]}
            >
              <Input
                prefix={<UserOutlined className="text-text-tertiary" />}
                placeholder={requireAdmin ? "请输入管理员账号" : "请输入用户名"}
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: "请输入密码" },
                { min: 6, message: "密码至少6个字符" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-text-tertiary" />}
                placeholder="请输入密码"
                size="large"
              />
            </Form.Item>

            <Form.Item className="mb-0 mt-2">
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={auth.isLoading}
                className="text-base"
                style={{ height: 44, fontWeight: 600 }}
              >
                {requireAdmin ? "管理员登录" : "登录"}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
