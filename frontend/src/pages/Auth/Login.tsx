import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "@hooks/useAuth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const LoginPage: React.FC = () => {
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
  const loginSchema = useMemo(
    () =>
      z.object({
        username: z
          .string()
          .trim()
          .min(1, requireAdmin ? "请输入管理员账号" : "请输入用户名"),
        password: z.string().min(6, "密码至少6个字符"),
      }),
    [requireAdmin],
  );

  type LoginFormValues = z.infer<typeof loginSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.isLoggedIn()) return;
    if (requireAdmin && !auth.isAdmin()) {
      showMessage.warning("当前账号不是管理员，请使用管理员账号登录");
      auth.logout();
      return;
    }
    navigate(redirect, { replace: true });
  }, [auth, navigate, redirect, requireAdmin]);

  const onFinish = async (values: LoginFormValues) => {
    const res = await auth.login(values.username, values.password);
    if (!res.success) {
      showMessage.error(res.error || "登录失败");
      return;
    }
    const role = res.user?.role_code || "";
    const isAdminUser = role === "admin" || role === "super_admin";
    if (requireAdmin && !isAdminUser) {
      showMessage.warning("当前账号不是管理员，无法访问管理后台");
      await auth.logout();
      return;
    }
    showMessage.success("登录成功");
    navigate(redirect, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--ws-color-primary) 6%, white) 0%, color-mix(in srgb, var(--ws-color-primary) 12%, white) 50%, color-mix(in srgb, var(--ws-color-secondary) 8%, white) 100%)" }}>

      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-[var(--ws-opacity-decoration-strong)]"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-[var(--ws-opacity-decoration-soft)]"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo 区 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-[calc(var(--ws-control-height)+var(--ws-space-1))] h-[calc(var(--ws-control-height)+var(--ws-space-1))] rounded-2xl mb-4 text-white text-2xl font-bold shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--ws-color-primary) 0%, var(--ws-color-secondary) 100%)" }}>
            W
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-text-base">
            {requireAdmin ? "管理员登录" : "登录"}
          </div>
          <div className="text-sm mt-1 text-text-secondary">
            {requireAdmin ? "仅管理员账号可进入后台" : "请输入账号密码继续"}
          </div>
        </div>

        {/* 表单卡片 */}
        <div className="rounded-2xl p-8 shadow-sm"
          style={{ background: "var(--ws-glass-bg)", backdropFilter: "var(--ws-glass-blur)" }}>
          <form
            onSubmit={handleSubmit(onFinish)}
            className="space-y-[var(--ws-space-3)]"
            autoComplete="off"
          >
            <div className="space-y-2">
              <Label htmlFor="username">{requireAdmin ? "管理员账号" : "用户名"}</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  id="username"
                  className="h-[var(--ws-control-height)] pl-[var(--ws-search-input-padding-start)]"
                  placeholder={requireAdmin ? "请输入管理员账号" : "请输入用户名"}
                  autoComplete="username"
                  {...register("username")}
                />
              </div>
              {errors.username?.message ? (
                <p className="text-xs text-destructive" aria-live="polite">{errors.username.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  id="password"
                  type="password"
                  className="h-[var(--ws-control-height)] pl-[var(--ws-search-input-padding-start)]"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  {...register("password")}
                />
              </div>
              {errors.password?.message ? (
                <p className="text-xs text-destructive" aria-live="polite">{errors.password.message}</p>
              ) : null}
            </div>

            <Button
              type="submit"
              className="h-[var(--ws-control-height)] w-full text-base font-semibold"
              disabled={auth.isLoading}
            >
              {auth.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {requireAdmin ? "管理员登录" : "登录"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
