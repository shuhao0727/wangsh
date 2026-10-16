import React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ShieldX } from "lucide-react";
import useAuth from "@hooks/useAuth";
import { Button } from "@/components/ui/button";
import { REGISTERED_USER_ROLES, canAccessRoles } from "./roleAccess";

const AuthenticatedGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
      </div>
    );
  }

  const here = `${location.pathname}${location.search}${location.hash}`;
  if (!auth.isLoggedIn()) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(here)}`} replace />;
  }

  if (!canAccessRoles(auth.user?.role_code, REGISTERED_USER_ROLES)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <ShieldX className="mx-auto mb-4 h-16 w-16 text-error" />
          <div className="mb-2 text-2xl font-bold text-text-base">请登录正式账号</div>
          <div className="mb-6 text-base text-text-secondary">
            访客模式不能使用智能体对话
          </div>
          <Button
            onClick={async () => {
              await auth.logout();
              void navigate(`/login?redirect=${encodeURIComponent(here)}`, { replace: true });
            }}
          >
            退出并登录
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthenticatedGuard;
