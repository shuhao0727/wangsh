import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin, Result, Button } from "antd";
import { LoadingOutlined, LoginOutlined } from "@ant-design/icons";
import useAuth from "@hooks/useAuth";
import LoginForm from "./LoginForm";

interface ProtectedRouteProps {
  /** 子元素 */
  children: React.ReactNode;
  /** 是否需要管理员权限（默认不需要） */
  requireAdmin?: boolean;
  /** 重定向路径（未登录时重定向） */
  redirectTo?: string;
  /** 是否显示登录模态框（默认为true） */
  showLoginModal?: boolean;
  /** 自定义未授权页面 */
  unauthorizedComponent?: React.ReactNode;
}

/**
 * 受保护路由组件
 * 用于控制页面访问权限
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  redirectTo = "/home",
  showLoginModal = true,
  unauthorizedComponent,
}) => {
  const location = useLocation();
  const auth = useAuth();
  const [loginVisible, setLoginVisible] = useState(false);

  // 如果正在加载，显示加载中
  if (auth.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
      </div>
    );
  }

  // 检查登录状态
  const isAuthenticated = auth.isLoggedIn();

  // 如果需要管理员权限，检查是否是管理员
  const isAuthorized = requireAdmin ? auth.isAdmin() : isAuthenticated;

  // 如果用户已登录且授权，直接渲染子组件
  if (isAuthenticated && isAuthorized) {
    return <>{children}</>;
  }

  // 如果用户未登录
  if (!isAuthenticated) {
    // 如果不显示登录模态框，直接重定向
    if (!showLoginModal) {
      return <Navigate to={redirectTo} replace state={{ from: location }} />;
    }

    // 显示登录模态框
    return (
      <>
        <div style={{ textAlign: "center", padding: "100px" }}>
          <Result
            status="403"
            title="需要登录"
            subTitle="请先登录以访问此页面"
            extra={[
              <Button
                key="login"
                type="primary"
                icon={<LoginOutlined />}
                onClick={() => setLoginVisible(true)}
              >
                立即登录
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
            // 登录成功后刷新页面
            window.location.reload();
          }}
        />
      </>
    );
  }

  // 用户已登录但权限不足（需要管理员权限但不是管理员）
  if (!isAuthorized) {
    // 如果有自定义未授权组件，使用自定义组件
    if (unauthorizedComponent) {
      return <>{unauthorizedComponent}</>;
    }

    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Result
          status="403"
          title="权限不足"
          subTitle="您没有权限访问此页面，需要管理员权限"
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
          ]}
        />
      </div>
    );
  }

  // 理论上不会执行到这里
  return null;
};

export default ProtectedRoute;
