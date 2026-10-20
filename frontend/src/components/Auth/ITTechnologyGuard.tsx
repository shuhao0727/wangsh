import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import RoleGuard from "./RoleGuard";
import { IT_TECHNOLOGY_MANAGEMENT_ROLES, STAFF_ROLES } from "./roleAccess";

/** Only the KNN view of the IT entry page is shared with teachers. */
export default function ITTechnologyGuard({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();
  const roles = params.get("view") === "knn" ? STAFF_ROLES : IT_TECHNOLOGY_MANAGEMENT_ROLES;
  return <RoleGuard roles={roles}>{children}</RoleGuard>;
}
