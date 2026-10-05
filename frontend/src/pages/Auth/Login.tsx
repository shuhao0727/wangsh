import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useState } from "react";
import AnimatedLoginCharacters from "@/components/Auth/AnimatedLoginCharacters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, Eye, EyeOff } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "@hooks/useAuth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { resolveLoginDestination } from "@/utils/loginDestination";

import { Spinner } from "@/components/ui/spinner";
const LoginPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const redirect = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return resolveLoginDestination(sp.get("redirect"));
  }, [location.search]);

  const requireAdmin = useMemo(() => redirect.startsWith("/admin"), [redirect]);
  const loginSchema = useMemo(
    () =>
      z.object({
        username: z
          .string()
          .trim()
          .min(1, requireAdmin ? "请输入管理员账号" : "请输入用户名"),
        password: z.string().min(1, "请输入密码"),
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
    if (requireAdmin && !auth.isStaff()) {
      showMessage.warning("当前账号没有管理后台权限");
      void auth.logout();
      return;
    }
    void navigate(redirect, {
      replace: true,
    });
  }, [auth, navigate, redirect, requireAdmin]);

  const onFinish = async (values: LoginFormValues) => {
    const res = await auth.login(values.username, values.password);
    if (!res.success) {
      showMessage.error(res.error || "登录失败");
      return;
    }
    const role = res.user?.role_code || "";
    const isStaffUser = role === "teacher" || role === "admin" || role === "super_admin";
    if (requireAdmin && !isStaffUser) {
      showMessage.warning("当前账号没有管理后台权限");
      await auth.logout();
      return;
    }
    localStorage.removeItem("ws_guest_mode");
    showMessage.success("登录成功");
    void navigate(redirect, { replace: true });
  };

  return (
    <div className="min-h-screen max-h-screen overflow-hidden grid lg:grid-cols-2">
      {/* ── Left: Brand / Visual Panel ──
          渐变走 token 而非硬编码：原先写死 #0D9488→#14B8A6→#7C3AED，
          其中 #14B8A6 是亮青绿、白字对比度仅 2.49:1，且改主色时要手动同步这里。 */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden"
        style={{ background: "linear-gradient(160deg, var(--ws-color-primary) 0%, var(--ws-color-primary-hover) 35%, var(--ws-color-accent) 100%)" }}>
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

        {/* Bottom spacer for balance */}
        <div className="relative z-20 h-9" />

        {/* Decorative blobs */}
        <div className="absolute top-1/4 right-1/4 size-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-white/[0.08] rounded-full blur-3xl" />
        {/* 装饰光斑：Tailwind 的 "/20" 透明度修饰符对 var(--ws-*) 颜色不会生成规则
            （JIT 无法对 CSS 变量做 alpha 合成），必须用 color-mix 保留 20% 语义。 */}
        <div className="absolute top-1/2 left-1/2 size-48 rounded-full blur-2xl"
          style={{ background: "color-mix(in srgb, var(--ws-color-accent) 20%, transparent)" }} />
      </div>

      {/* ── Right: Login Form ── */}
      <div className="flex items-center justify-center p-8"
        style={{ background: "var(--ws-color-bg)" }}>
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-xs mb-10">
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
          <form onSubmit={handleSubmit(onFinish)} className="space-y-form-field-gap" autoComplete="off">
            <div className="space-y-xs">
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

            <div className="space-y-xs">
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
              {auth.isLoading && <Spinner size="sm" />}
              {requireAdmin ? "管理员登录" : "登录"}
            </Button>
          </form>

          {/* Guest mode */}
          {!requireAdmin && (
            <div className="text-center text-sm text-text-secondary mt-6">
              <button
                type="button"
                onClick={() => { localStorage.setItem("ws_guest_mode", "1"); void navigate("/home"); }}
                className="text-text-tertiary hover:text-text-secondary transition-colors underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
