import type { AppRole } from "./roleAccess";

export const IT_GAMES_ADMIN_ROLES = ["admin", "super_admin"] as const satisfies readonly AppRole[];

export const canManageITGameRepo = (role: string | undefined) =>
  IT_GAMES_ADMIN_ROLES.includes(role as (typeof IT_GAMES_ADMIN_ROLES)[number]);
