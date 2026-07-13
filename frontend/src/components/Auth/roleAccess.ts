export type AppRole = "super_admin" | "admin" | "teacher" | "student";

export const ADMIN_ROLES = ["admin", "super_admin"] as const satisfies readonly AppRole[];
export const STAFF_ROLES = ["teacher", "admin", "super_admin"] as const satisfies readonly AppRole[];
export const SUPER_ADMIN_ROLES = ["super_admin"] as const satisfies readonly AppRole[];

export const canAccessRoles = (
  role: string | undefined,
  allowedRoles: readonly AppRole[],
) => Boolean(role && allowedRoles.includes(role as AppRole));

export const canManageFeatureFlags = (role: string | undefined) =>
  role === "super_admin";

export function getAdminMenuWhitelist(role: string | undefined): Set<string> | null {
  if (role === "super_admin") return null;
  if (role === "admin") {
    return new Set([
      "/admin/dashboard",
      "/admin/ai-agents",
      "/admin/users",
      "/admin/agent-data",
      "/admin/group-discussion",
      "/admin/assessment",
      "/admin/classroom-interaction",
      "/admin/classroom-plan",
      "/admin/informatics",
      "/admin/it-technology",
    ]);
  }
  if (role === "teacher") {
    return new Set([
      "/admin/dashboard",
      "/admin/group-discussion",
      "/admin/classroom-interaction",
      "/admin/classroom-plan",
      "/admin/informatics",
    ]);
  }
  return new Set();
}
