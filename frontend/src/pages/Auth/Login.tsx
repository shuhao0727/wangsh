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
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.isLoggedIn()) return;
    if (requireAdmin && !auth.isAdmin()) {
      showMessage.warning("当前账号不是管理员，请使用管理员账号登录");
      void auth.logout();
      return;
    }
    void navigate(redirect, { replace: true });
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
    void navigate(redirect, { replace: true });
  };

  return (
    <div className="min-h-screen max-h-screen overflow-hidden grid lg:grid-cols-2">
      {/* ── Left: Brand / Visual Panel ── */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0D9488 0%, #14B8A6 35%, #7C3AED 100%)" }}>
        {/* Logo */}
        <div className="relative z-20">
          <div className="flex items-center gap-3 text-lg font-semibold text-white">
            <div className="grid h-9 w-9 shrink-0 place-content-center rounded-xl text-sm font-bold"
              style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)" }}>
              W
            </div>
            <span>WangSh 平台</span>
          </div>
        </div>

        {/* Center: geometric code shapes */}
        <div className="relative z-20 flex items-center justify-center" style={{ height: 400 }}>
          <div className="login-animation active">
            {/* Code bracket shapes */}
            <svg viewBox="0 0 320 200" className="w-80 h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g opacity="0.9">
                <text x="40" y="45" fill="rgba(255,255,255,0.85)" fontFamily="monospace" fontSize="18" fontWeight="700">{`<WangSh>`}</text>
                <text x="40" y="75" fill="rgba(255,255,255,0.55)" fontFamily="monospace" fontSize="14">{`  discover()`}</text>
                <text x="40" y="97" fill="rgba(255,255,255,0.55)" fontFamily="monospace" fontSize="14">{`  learn()`}</text>
                <text x="40" y="119" fill="rgba(255,255,255,0.7)" fontFamily="monospace" fontSize="14">{`  build()`}</text>
                <text x="40" y="149" fill="rgba(255,255,255,0.85)" fontFamily="monospace" fontSize="18" fontWeight="700">{`</WangSh>`}</text>
              </g>
            </svg>
            {/* Decorative floating dots */}
            <div className="login-dot login-dot-1" />
            <div className="login-dot login-dot-2" />
            <div className="login-dot login-dot-3" />
          </div>
        </div>

        {/* Bottom links */}
        <div className="relative z-20 flex items-center gap-6 text-sm text-white/60">
          <a href="/home" className="hover:text-white transition-colors">返回首页</a>
          <span className="text-white/30">v1.5.11</span>
        </div>

        {/* Decorative blobs */}
        <div className="absolute top-1/4 right-1/4 size-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-white/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 size-48 bg-violet-400/20 rounded-full blur-2xl" />
      </div>

      {/* ── Right: Login Form ── */}
      <div className="flex items-center justify-center p-8"
        style={{ background: "var(--ws-color-bg)" }}>
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
            <div className="grid h-9 w-9 shrink-0 place-content-center rounded-xl text-sm font-bold text-white"
              style={{ background: "var(--ws-gradient-primary)" }}>
              W
            </div>
            <span className="text-lg font-semibold">WangSh 平台</span>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              {requireAdmin ? "管理员登录" : "欢迎回来"}
            </h1>
            <p className="text-sm text-text-secondary">
              {requireAdmin ? "仅管理员账号可进入后台" : "课程、训练与工具入口"}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onFinish)} className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                {requireAdmin ? "管理员账号" : "用户名"}
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  id="username"
                  className="h-11 pl-9"
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
              <Label htmlFor="password" className="text-sm font-medium">密码</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  id="password"
                  type="password"
                  className="h-11 pl-9"
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
              className="h-11 w-full text-base font-semibold"
              disabled={auth.isLoading}
            >
              {auth.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {requireAdmin ? "管理员登录" : "登录"}
            </Button>
          </form>
        </div>
      </div>
      <style>{`
        .login-animation svg text { transition: opacity 0.4s ease; }
        .login-animation.active text:nth-child(3) { opacity: 0.8; }
        .login-animation.active text:nth-child(4) { opacity: 0.8; }

        .login-dot {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          pointer-events: none;
        }
        .login-dot-1 { width: 8px; height: 8px; top: 20%; left: 15%; animation: loginFloatA 4s ease-in-out infinite; }
        .login-dot-2 { width: 6px; height: 6px; top: 65%; right: 20%; animation: loginFloatB 5s ease-in-out infinite; }
        .login-dot-3 { width: 10px; height: 10px; bottom: 30%; left: 60%; animation: loginFloatA 3.5s ease-in-out infinite 1s; }

        @keyframes loginFloatA {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-16px) scale(1.6); opacity: 0.7; }
        }
        @keyframes loginFloatB {
          0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.25; }
          50% { transform: translateY(-12px) translateX(8px) scale(1.8); opacity: 0.65; }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-dot { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
