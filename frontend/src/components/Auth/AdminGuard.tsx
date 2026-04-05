import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldX } from "lucide-react";
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
      </div>
    );
  }

  if (!auth.isLoggedIn()) {
    return null;
  }

  if (!auth.isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShieldX className="h-16 w-16 text-error mx-auto mb-4" />
          <div className="text-2xl font-bold text-text-base mb-2">权限不足</div>
          <div className="text-base text-text-secondary mb-6">需要管理员权限才能访问管理后台</div>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => navigate("/home", { replace: true })}>
              返回首页
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await auth.logout();
                navigate("/login?redirect=%2Fadmin%2Fdashboard", { replace: true });
              }}
            >
              退出并切换账号
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
