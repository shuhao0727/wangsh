import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ShieldX } from "lucide-react";
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
      void navigate(`/login?redirect=${encodeURIComponent(here)}`, { replace: true });
      return;
    }
  }, [auth, location.hash, location.pathname, location.search, navigate]);

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {/* 原为 <Loader2 h-9 w-9> 且无任何 aria：屏幕阅读器静默。LoadingState 自带
            role="status" + 可访问名称，尺寸 xl(=h-8) 与原 h-9 视觉一致。 */}
        <LoadingState label="正在校验权限…" size="2xl" />
      </div>
    );
  }

  if (!auth.isLoggedIn()) {
    return null;
  }

  if (!auth.isStaff()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShieldX className="h-16 w-16 text-error mx-auto mb-4" />
          <div className="text-2xl font-bold text-text-base mb-xs">权限不足</div>
          <div className="text-base text-text-secondary mb-6">需要教职工权限才能访问管理后台</div>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => void navigate("/home", { replace: true })}>
              返回首页
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await auth.logout();
                void navigate("/login?redirect=%2Fadmin%2Fdashboard", { replace: true });
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
