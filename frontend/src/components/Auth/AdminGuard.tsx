import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Result, Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import useAuth from "@hooks/useAuth";

type Props = {
  children: React.ReactNode;
};

const AdminGuard: React.FC<Props> = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isLoading) return;
    const here = `${location.pathname}${location.search}${location.hash}`;
    if (!auth.isLoggedIn()) {
      navigate(`/login?redirect=${encodeURIComponent(here)}`, { replace: true });
      return;
    }
  }, [auth, location.hash, location.pathname, location.search, navigate]);

  if (auth.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
      </div>
    );
  }

  if (!auth.isLoggedIn()) {
    return null;
  }

  if (!auth.isAdmin()) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Result
          status="403"
          title="权限不足"
          subTitle="需要管理员权限才能访问管理后台"
          extra={[
            <Button key="home" type="primary" onClick={() => navigate("/home", { replace: true })}>
              返回首页
            </Button>,
            <Button
              key="logout"
              danger
              onClick={async () => {
                await auth.logout();
                navigate("/login?redirect=%2Fadmin%2Fdashboard", { replace: true });
              }}
            >
              退出并切换账号
            </Button>,
          ]}
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
