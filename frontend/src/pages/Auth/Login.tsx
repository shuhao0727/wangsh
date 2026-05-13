import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useState } from "react";
import AnimatedLoginCharacters from "@/components/Auth/AnimatedLoginCharacters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, Loader2, Eye, EyeOff } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "@hooks/useAuth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const LoginPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const redirect = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const raw = sp.get("redirect") || "/home";
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/home";
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
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const password = watch("password");

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

        {/* Center: animated characters */}
        <div className="relative z-20 flex items-center justify-center" style={{ height: 400 }}>
          <AnimatedLoginCharacters isFocused={isFocused} showPassword={showPassword} passwordLength={password.length} />
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
            <h1 className="text-2xl font-bold tracking-tight">
              {requireAdmin ? "管理员登录" : "登录"}
            </h1>
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
                  {...register("username", {
                    onBlur: () => setIsFocused(false),
                  })}
                  onFocus={() => setIsFocused(true)}
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
                  type={showPassword ? "text" : "password"}
                  className="h-11 pl-9 pr-10"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
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

          {/* Guest mode */}
          {!requireAdmin && (
            <div className="text-center text-sm text-text-secondary mt-6">
              <button
                type="button"
                onClick={() => navigate("/home")}
                className="text-text-tertiary hover:text-text-secondary transition-colors underline underline-offset-4"
              >
                访客模式进入
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
