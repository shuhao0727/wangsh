import React, { useState } from "react";
import { Spin, Result, Button } from "antd";
import {
  LoadingOutlined,
  LoginOutlined,
  LockOutlined,
} from "@ant-design/icons";
import useAuth from "@hooks/useAuth";
import LoginForm from "./LoginForm";

interface AdminRouteProps {
  /** 子元素 */
  children: React.ReactNode;
  /** 是否要求超级管理员权限（默认false，普通管理员即可） */
  requireSuperAdmin?: boolean;
  /** 重定向路径（未登录时重定向） */
  redirectTo?: string;
  /** 是否显示登录模态框（默认为true） */
  showLoginModal?: boolean;
  /** 自定义未授权页面 */
  unauthorizedComponent?: React.ReactNode;
}

/**
 * 管理员路由组件
 * 专门用于管理后台页面，需要管理员权限
 */
const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  requireSuperAdmin = false,
  redirectTo = "/home",
  showLoginModal = true,
  unauthorizedComponent,
}) => {
  const auth = useAuth();
  const [loginVisible, setLoginVisible] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(true);

  // 如果正在加载，显示加载中
  if (auth.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
      </div>
    );
  }

  // 检查登录状态和管理员权限
  const isAuthenticated = auth.isLoggedIn();

  // 检查管理员权限
  let isAuthorized = false;
  if (requireSuperAdmin) {
    isAuthorized = auth.isSuperAdmin();
  } else {
    isAuthorized = auth.isAdmin();
  }

  // 如果用户是管理员且已授权，直接渲染子组件
  if (isAuthenticated && isAuthorized) {
    return <>{children}</>;
  }

  // 如果用户未登录
  if (!isAuthenticated) {
    // 如果不显示登录模态框，直接重定向
    if (!showLoginModal) {
      window.location.href = redirectTo;
      return null;
    }

    // 显示管理员登录模态框
    return (
      <>
        <div style={{ textAlign: "center", padding: "100px" }}>
          <Result
            status="403"
            icon={<LockOutlined />}
            title="需要管理员权限"
            subTitle={`请使用管理员账号登录以访问管理后台${requireSuperAdmin ? "（需要超级管理员权限）" : ""}`}
            extra={[
              <Button
                key="login"
                type="primary"
                icon={<LoginOutlined />}
                onClick={() => {
                  setIsAdminLogin(true);
                  setLoginVisible(true);
                }}
              >
                管理员登录
              </Button>,
              <Button
                key="home"
                onClick={() => (window.location.href = redirectTo)}
              >
                返回首页
              </Button>,
            ]}
          />
        </div>
        <LoginForm
          visible={loginVisible}
          onClose={() => setLoginVisible(false)}
          onSuccess={() => {
            // 登录成功后重新检查权限
            if (auth.isLoggedIn()) {
              const authorized = requireSuperAdmin
                ? auth.isSuperAdmin()
                : auth.isAdmin();
              if (authorized) {
                // 如果是管理员且授权，刷新页面
                window.location.reload();
              } else {
                // 如果不是管理员，显示权限不足
                auth.logout();
                setLoginVisible(false);
              }
            }
          }}
          isAdmin={isAdminLogin}
          title={requireSuperAdmin ? "超级管理员登录" : "管理员登录"}
        />
      </>
    );
  }

  // 用户已登录但不是管理员
  if (isAuthenticated && !isAuthorized) {
    // 如果有自定义未授权组件，使用自定义组件
    if (unauthorizedComponent) {
      return <>{unauthorizedComponent}</>;
    }

    const roleText = auth.getUserRole();
    const requiredRole = requireSuperAdmin ? "超级管理员" : "管理员";

    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Result
          status="403"
          title="权限不足"
          subTitle={`当前账号角色：${roleText}，需要${requiredRole}权限才能访问管理后台`}
          extra={[
            <Button
              key="home"
              type="primary"
              onClick={() => (window.location.href = redirectTo)}
            >
              返回首页
            </Button>,
            <Button
              key="logout"
              danger
              onClick={() => {
                auth.logout();
                window.location.href = redirectTo;
              }}
            >
              退出登录
            </Button>,
            <Button
              key="admin-login"
              onClick={() => {
                setIsAdminLogin(true);
                setLoginVisible(true);
              }}
            >
              使用管理员账号登录
            </Button>,
          ]}
        />
        <LoginForm
          visible={loginVisible}
          onClose={() => setLoginVisible(false)}
          onSuccess={() => {
            // 登录成功后重新检查权限
            if (auth.isLoggedIn()) {
              const authorized = requireSuperAdmin
                ? auth.isSuperAdmin()
                : auth.isAdmin();
              if (authorized) {
                // 如果是管理员且授权，刷新页面
                window.location.reload();
              } else {
                // 如果不是管理员，显示权限不足
                auth.logout();
                setLoginVisible(false);
              }
            }
          }}
          isAdmin={isAdminLogin}
          title={requireSuperAdmin ? "超级管理员登录" : "管理员登录"}
        />
      </div>
    );
  }

  // 理论上不会执行到这里
  return null;
};

export default AdminRoute;
