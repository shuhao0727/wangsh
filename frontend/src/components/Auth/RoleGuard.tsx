import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldX } from "lucide-react";
import useAuth from "@hooks/useAuth";
import { canAccessRoles, type AppRole } from "./roleAccess";
import { LoadingState } from "@/components/ui/loading-state";

const RoleGuard: React.FC<{
  children: React.ReactNode;
  roles: readonly AppRole[];
}> = ({ children, roles }) => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="正在校验访问权限…" size="2xl" />
      </div>
    );
  }

  const here = `${location.pathname}${location.search}${location.hash}`;
  if (!auth.isLoggedIn()) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(here)}`} replace />;
  }

  if (!canAccessRoles(auth.user?.role_code, roles)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <ShieldX className="mx-auto mb-4 h-16 w-16 text-error" />
          <div className="mb-xs text-2xl font-bold text-text-base">权限不足</div>
          <div className="text-base text-text-secondary">当前角色无权访问此页面</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RoleGuard;
