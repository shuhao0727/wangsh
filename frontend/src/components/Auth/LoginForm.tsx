import React, { useState } from "react";
import { User, Lock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showMessage } from "@/lib/toast";
import useAuth from "@hooks/useAuth";
import { logger } from "@services/logger";

interface LoginFormProps {
  /** 是否可见 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 登录成功回调 */
  onSuccess?: () => void;
  /** 标题 */
  title?: string;
  /** 是否为管理员登录 */
  isAdmin?: boolean;
}

/**
 * 模块化登录表单组件
 * 支持管理员和普通用户登录
 */
const LoginForm: React.FC<LoginFormProps> = ({
  visible,
  onClose,
  onSuccess,
  title,
  isAdmin = false,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const auth = useAuth();

  // 表单验证
  const validate = (): boolean => {
    const newErrors: { username?: string; password?: string } = {};
    if (!username.trim()) {
      newErrors.username = isAdmin ? "请输入管理员账号" : "请输入用户名";
    }
    if (!password) {
      newErrors.password = "请输入密码";
    } else if (password.length < 6) {
      newErrors.password = "密码至少6个字符";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理登录提交
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const result = await auth.login(username, password);
      if (result.success) {
        showMessage.success(isAdmin ? "管理员登录成功！" : "登录成功！");

        // 如果是管理员登录，检查权限
        const role = result.user?.role_code || "";
        const isAdminUser = role === "admin" || role === "super_admin";
        if (isAdmin && !isAdminUser) {
          showMessage.error("当前账号不是管理员，无法访问管理后台");
          auth.logout();
          return;
        }

        // 关闭模态框并重置
        handleClose();

        // 触发成功回调
        if (onSuccess) {
          onSuccess();
        }
      } else {
        showMessage.error(result.error || "登录失败");
      }
    } catch (error) {
      logger.error("登录过程中发生错误:", error);
      showMessage.error("登录过程中发生错误");
    }
  };

  // 处理关闭
  const handleClose = () => {
    setUsername("");
    setPassword("");
    setErrors({});
    onClose();
  };

  // 确定模态框标题
  const modalTitle = title || (isAdmin ? "管理员登录" : "用户登录");

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
          {/* 用户名 */}
          <div className="space-y-2">
            <Label htmlFor="username">
              {isAdmin ? "管理员账号" : "用户名"}
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                }}
                placeholder={isAdmin ? "请输入管理员账号" : "请输入用户名"}
                className="h-[var(--ws-control-height)] pl-[var(--ws-search-input-padding-start)]"
              />
            </div>
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username}</p>
            )}
          </div>

          {/* 密码 */}
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="请输入密码"
                className="h-[var(--ws-control-height)] pl-[var(--ws-search-input-padding-start)]"
              />
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          {/* 提交按钮 */}
          <Button
            type="submit"
            className="w-full h-11"
            disabled={auth.isLoading}
          >
            {auth.isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <User className="mr-2 h-4 w-4" />
            )}
            {isAdmin ? "管理员登录" : "用户登录"}
          </Button>

          {isAdmin && (
            <div className="text-center mt-4">
              <p className="text-xs text-muted-foreground">
                提示：仅支持管理员账号登录
              </p>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LoginForm;
