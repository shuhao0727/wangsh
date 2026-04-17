import React from "react";
import { User, LayoutDashboard, Bot, Home, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import useAuth from "@hooks/useAuth";
import { notifyAuthExpired } from "@services/api";
import { logger } from "@services/logger";

interface UserMenuProps {
  /** 显示模式：avatar（头像）或 button（按钮） */
  mode?: "avatar" | "button";
  /** 是否显示用户名称 */
  showName?: boolean;
  /** 点击菜单项的回调 */
  onMenuClick?: (key: string) => void;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 模块化用户菜单组件
 * 根据用户角色显示不同的菜单项
 */
const UserMenu: React.FC<UserMenuProps> = ({
  mode = "avatar",
  showName = true,
  onMenuClick,
  style = {},
}) => {
  const navigate = useNavigate();
  const auth = useAuth();

  // 处理菜单点击
  const handleMenuClick = (key: string) => {
    if (onMenuClick) {
      onMenuClick(key);
    }
  };

  // 获取用户显示名称
  const getDisplayName = () => {
    if (!auth.user) return "用户";

    if (auth.user.role_code === "student") {
      return auth.user.full_name || auth.user.student_id || "学生";
    } else {
      return auth.user.username || auth.user.full_name || "管理员";
    }
  };

  // 获取用户角色显示文本
  const getRoleText = () => {
    const role = auth.getUserRole();
    switch (role) {
      case "super_admin":
        return "超级管理员";
      case "admin":
        return "管理员";
      case "student":
        return "学生";
      default:
        return "访客";
    }
  };

  // 获取用户头像颜色
  const getAvatarColor = () => {
    const role = auth.getUserRole();
    switch (role) {
      case "super_admin":
        return "bg-[var(--ws-color-error)]";
      case "admin":
        return "bg-primary";
      case "student":
        return "bg-[var(--ws-color-success)]";
      default:
        return "bg-[var(--ws-color-purple)]";
    }
  };

  // 获取用户名首字母
  const getInitials = () => {
    const name = getDisplayName();
    return name.charAt(0).toUpperCase();
  };

  // 如果用户未登录，显示登录按钮
  if (!auth.isLoggedIn()) {
    const replayStoredAuthExpiredReason = () => {
      if (typeof window === "undefined") return;
      const detail = (
        window as typeof window & {
          __wsLastAuthExpiredDetail?: { reason?: string } | null;
        }
      ).__wsLastAuthExpiredDetail;
      const reason = typeof detail?.reason === "string" ? detail.reason.trim() : "";
      if (reason) notifyAuthExpired(reason);
    };
    if (mode === "button") {
      return (
        <Button
          onClick={() => {
            replayStoredAuthExpiredReason();
            if (onMenuClick) {
              onMenuClick("login");
            }
          }}
          style={style}
        >
          <User className="mr-2 h-4 w-4" />
          登录
        </Button>
      );
    }

    // avatar模式下，添加点击事件来触发登录弹窗
    return (
      <div
        className="flex items-center cursor-pointer"
        onClick={(e) => {
          logger.debug("UserMenu - 点击未登录区域");
          e.stopPropagation();
          replayStoredAuthExpiredReason();
          if (onMenuClick) {
            logger.debug("UserMenu - 调用 onMenuClick('login')");
            onMenuClick("login");
          } else {
            logger.warn("UserMenu - onMenuClick 回调未定义");
          }
        }}
        title="点击登录"
      >
        <Avatar className={`${showName ? "mr-2" : ""} h-8 w-8`}>
          <AvatarFallback className="bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        {showName && <span className="text-[length:var(--ws-text-nav)] text-muted-foreground">未登录</span>}
      </div>
    );
  }

  // 用户已登录，显示用户菜单
  const userInfo = (
    <div className="flex items-center">
      <Avatar className={`${showName ? "mr-2" : ""} ${mode === "button" ? "h-6 w-6" : "h-8 w-8"}`}>
        <AvatarFallback className={`${getAvatarColor()} text-white text-xs`}>
          {getInitials()}
        </AvatarFallback>
      </Avatar>
      {showName && (
        <div className="flex flex-col leading-tight">
          <span className="text-[length:var(--ws-text-nav)] font-medium">{getDisplayName()}</span>
          <span className="text-[length:var(--ws-text-xs)] text-muted-foreground">{getRoleText()}</span>
        </div>
      )}
    </div>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {mode === "button" ? (
          <Button variant="ghost" className="px-2 py-1 h-auto" style={style}>
            {userInfo}
          </Button>
        ) : (
          <div className="cursor-pointer" style={style}>{userInfo}</div>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {auth.isAdmin() ? (
          <DropdownMenuItem
            onClick={() => {
              handleMenuClick("/admin/dashboard");
              const adminUrl = `${window.location.origin}/admin/dashboard`;
              window.open(adminUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            后端管理
          </DropdownMenuItem>
        ) : auth.isLoggedIn() ? (
          <DropdownMenuItem
            onClick={() => {
              handleMenuClick("/ai-agents");
              navigate("/ai-agents");
            }}
          >
            <Bot className="mr-2 h-4 w-4" />
            我的AI助手
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            handleMenuClick("/home");
            navigate("/home");
          }}
        >
          <Home className="mr-2 h-4 w-4" />
          返回首页
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            handleMenuClick("logout");
            auth.logout();
            navigate("/home");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
