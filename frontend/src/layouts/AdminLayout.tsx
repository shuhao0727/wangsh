import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  AppWindow,
  Bot,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Code2,
  Database,
  FileText,
  Home,
  Laptop,
  LayoutDashboard,
  ListOrdered,
  Lock,
  LogOut,
  Menu,
  Monitor,
  PanelLeftClose,
  Settings,
  User,
  Users,
  Zap,
} from "lucide-react";
import useAuth from "@hooks/useAuth";
import useAppMeta from "@hooks/useAppMeta";
import { useBreakpoint } from "@hooks/useBreakpoint";

type AdminMenuItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  children?: AdminMenuItem[];
};

const agentPaths = [
  "/admin/ai-agents",
  "/admin/users",
  "/admin/agent-data",
  "/admin/group-discussion",
  "/admin/assessment",
  "/admin/classroom-interaction",
  "/admin/classroom-plan",
];

const adminMenuItems: AdminMenuItem[] = [
  {
    key: "/admin/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    label: "状态概览",
  },
  {
    key: "/admin/agents",
    icon: <Bot className="h-4 w-4" />,
    label: "智能体",
    children: [
      { key: "/admin/ai-agents", icon: <Bot className="h-4 w-4" />, label: "AI智能体管理" },
      { key: "/admin/users", icon: <Users className="h-4 w-4" />, label: "用户管理" },
      { key: "/admin/agent-data", icon: <Database className="h-4 w-4" />, label: "智能体数据" },
      { key: "/admin/group-discussion", icon: <Monitor className="h-4 w-4" />, label: "小组讨论" },
      { key: "/admin/assessment", icon: <ClipboardCheck className="h-4 w-4" />, label: "自适应测评" },
      { key: "/admin/classroom-interaction", icon: <Zap className="h-4 w-4" />, label: "课堂互动" },
      { key: "/admin/classroom-plan", icon: <ListOrdered className="h-4 w-4" />, label: "课堂计划" },
    ],
  },
  { key: "/admin/informatics", icon: <Code2 className="h-4 w-4" />, label: "信息学竞赛" },
  { key: "/admin/it-technology", icon: <Laptop className="h-4 w-4" />, label: "信息技术" },
  { key: "/admin/personal-programs", icon: <AppWindow className="h-4 w-4" />, label: "个人程序" },
  { key: "/admin/articles", icon: <FileText className="h-4 w-4" />, label: "文章管理" },
  { key: "/admin/system", icon: <Settings className="h-4 w-4" />, label: "系统设置" },
];

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [collapsed, setCollapsed] = useState(false);
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [loginValues, setLoginValues] = useState({ username: "", password: "" });
  const { version, envLabel } = useAppMeta();

  const path = location.pathname;
  const selectedKey = path === "/admin" || path === "/admin/" ? "/admin/dashboard" : path;
  const inAgentGroup = agentPaths.some((p) => path.startsWith(p));
  const [agentsOpen, setAgentsOpen] = useState(inAgentGroup);

  useEffect(() => {
    if (inAgentGroup) setAgentsOpen(true);
  }, [inAgentGroup]);

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  const flatItems = useMemo(() => {
    const result: AdminMenuItem[] = [];
    adminMenuItems.forEach((item) => {
      if (item.children) result.push(...item.children);
      else result.push(item);
    });
    return result;
  }, []);

  const currentTitle =
    flatItems.find((item) => item.key === path)?.label || "管理后台";

  const roleLabel =
    auth.user?.role_code === "super_admin"
      ? "超级管理员"
      : auth.user?.role_code === "admin"
        ? "管理员"
        : auth.user?.role_code === "student"
          ? "学生用户"
          : "访客";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = loginValues.username.trim();
    const password = loginValues.password;
    if (username.length < 3) {
      showMessage.error("账号至少3个字符");
      return;
    }
    if (password.length < 6) {
      showMessage.error("密码至少6个字符");
      return;
    }
    const res = await auth.login(username, password);
    if (!res.success) {
      showMessage.error(res.error || "登录失败");
      return;
    }
    const role = res.user?.role_code || "";
    const isAdminUser = role === "admin" || role === "super_admin";
    if (!isAdminUser) {
      showMessage.error("当前账号不是管理员");
      await auth.logout();
      return;
    }
    showMessage.success("登录成功");
    setIsLoginModalVisible(false);
    setLoginValues({ username: "", password: "" });
  };

  const sidebarExpandedWidth = 236;
  const sidebarCollapsedWidth = 84;
  const sidebarWidth = isMobile ? sidebarExpandedWidth : collapsed ? sidebarCollapsedWidth : sidebarExpandedWidth;
  const contentMarginLeft = isMobile ? 0 : collapsed ? sidebarCollapsedWidth : sidebarExpandedWidth;

  const renderMenuButton = (item: AdminMenuItem) => {
    const active = selectedKey.startsWith(item.key);
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => {
          navigate(item.key);
          if (isMobile) setCollapsed(true);
        }}
        className={`appearance-none border-0 bg-transparent flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          active
            ? "bg-primary-soft text-primary"
            : "text-text-secondary hover:bg-[var(--ws-color-hover-bg)]"
        }`}
        title={collapsed ? item.label : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </button>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-surface">
      <Dialog open={isLoginModalVisible} onOpenChange={setIsLoginModalVisible}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>管理员登录</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleLogin}>
            <div className="space-y-1">
              <label className="text-sm text-text-secondary">管理员账号</label>
              <Input
                value={loginValues.username}
                placeholder="请输入管理员账号"
                onChange={(e) => setLoginValues((prev) => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-text-secondary">密码</label>
              <Input
                type="password"
                value={loginValues.password}
                placeholder="请输入密码"
                onChange={(e) => setLoginValues((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={auth.isLoading}>
              管理员登录
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {isMobile && !collapsed ? (
        <div
          className="fixed inset-0 z-[var(--ws-z-overlay)] bg-black/30"
          onClick={() => setCollapsed(true)}
        />
      ) : null}

      <aside
        className="fixed left-0 top-0 bottom-0 z-[var(--ws-z-header)] border-r border-border-secondary bg-surface transition-all duration-200"
        style={{
          width: sidebarWidth,
          transform: isMobile && collapsed ? "translateX(-100%)" : "translateX(0)",
          boxShadow: isMobile ? "var(--ws-shadow-xl)" : "none",
        }}
      >
        <div
          className="flex cursor-pointer select-none items-center gap-2.5 px-4 py-4"
          onClick={() => navigate("/admin/dashboard")}
        >
          <div
            className="grid h-8 w-8 shrink-0 place-content-center rounded-lg text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--ws-color-primary) 0%, var(--ws-color-purple) 100%)" }}
          >
            W
          </div>
          {!collapsed ? (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-text-base">管理后台</span>
              {envLabel ? <span className="text-xs text-text-tertiary">{envLabel}</span> : null}
            </div>
          ) : null}
        </div>

        <div className="mx-4 mb-2 h-px bg-border-secondary" />

        <div className="h-[calc(100%-148px)] overflow-y-auto px-3 pb-3">
          <div className="space-y-1">
            {adminMenuItems.map((item) => {
              if (!item.children) return renderMenuButton(item);
              return (
                <div key={item.key} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        navigate(item.children?.[0]?.key || "/admin/ai-agents");
                        if (isMobile) setCollapsed(true);
                        return;
                      }
                      setAgentsOpen((v) => !v);
                    }}
                    className={`appearance-none border-0 bg-transparent flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      inAgentGroup
                        ? "bg-primary-soft text-primary"
                        : "text-text-secondary hover:bg-[var(--ws-color-hover-bg)]"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed ? (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {agentsOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                      </>
                    ) : null}
                  </button>
                  {!collapsed && agentsOpen ? (
                    <div className="ml-6 space-y-1">
                      {item.children.map((child) => renderMenuButton(child))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-border-secondary px-3 py-2.5">
          {!collapsed ? (
            <div className="mb-2 flex items-center gap-2">
              <Avatar className="h-7 w-7 shrink-0 bg-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-text-base">
                  {auth.user?.full_name || auth.user?.username || "管理员"}
                </div>
                <div className="truncate text-xs text-text-tertiary">{roleLabel}</div>
              </div>
            </div>
          ) : (
            <div className="mb-2 flex justify-center">
              <Avatar className="h-7 w-7 bg-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full text-xs text-text-secondary"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed ? "收起" : null}
          </Button>
        </div>
      </aside>

      <div
        className="flex h-full min-h-0 flex-col transition-all duration-200"
        style={{ marginLeft: contentMarginLeft }}
      >
        <header
          className="sticky top-0 z-[var(--ws-z-sticky)] flex items-center justify-between border-b border-border-secondary bg-surface px-4 md:px-6"
          style={{ height: "var(--ws-header-height)" }}
        >
          <div className="flex items-center gap-3">
            {isMobile ? (
              <Button variant="ghost" size="icon" onClick={() => setCollapsed((v) => !v)}>
                <Menu className="h-4 w-4" />
              </Button>
            ) : null}
            <span className="font-semibold text-text-base" style={{ fontSize: "var(--ws-text-nav)" }}>
              {currentTitle}
            </span>
            {version ? (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
                v{version}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {auth.isLoggedIn() && auth.isAdmin() ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="admin-user-menu appearance-none border-0 bg-transparent flex items-center gap-2 rounded-lg px-2 py-1 text-text-base"
                  >
                    <Avatar className="h-7 w-7 shrink-0 bg-primary/10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium sm:inline">
                      {auth.user?.full_name || auth.user?.username || "管理员"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/admin/users")}>
                    <User className="mr-2 h-4 w-4" />
                    管理员资料
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/")}>
                    <Home className="mr-2 h-4 w-4" />
                    返回首页
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={async () => {
                      await auth.logout();
                      showMessage.success("已退出登录");
                      navigate("/");
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" onClick={() => setIsLoginModalVisible(true)}>
                管理员登录
              </Button>
            )}
          </div>
        </header>

        <main
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{ height: "calc(100vh - var(--ws-header-height))" }}
        >
          {auth.isLoggedIn() && auth.isAdmin() ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <Outlet key={location.pathname} />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Lock className="h-12 w-12 text-text-tertiary" />
              <h3 className="text-xl font-semibold">需要管理员权限</h3>
              <p className="text-sm text-text-tertiary">只有管理员可以访问此页面</p>
              <Button onClick={() => setIsLoginModalVisible(true)}>管理员登录</Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
