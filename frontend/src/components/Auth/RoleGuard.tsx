import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldX } from "lucide-react";
import useAuth from "@hooks/useAuth";
import { canAccessRoles, type AppRole } from "./roleAccess";

const RoleGuard: React.FC<{
  children: React.ReactNode;
  roles: readonly AppRole[];
}> = ({ children, roles }) => {
  const auth = useAuth();
  const location = useLocation();

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

  if (!canAccessRoles(auth.user?.role_code, roles)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <ShieldX className="mx-auto mb-4 h-16 w-16 text-error" />
          <div className="mb-2 text-2xl font-bold text-text-base">权限不足</div>
          <div className="text-base text-text-secondary">当前角色无权访问此页面</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RoleGuard;
