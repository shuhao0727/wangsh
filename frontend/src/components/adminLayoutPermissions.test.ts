import { describe, expect, it } from "vitest";
import {
  canAccessAdminProfile,
  canAccessRoles,
  getAdminMenuTarget,
  getAdminMenuWhitelist,
  IT_TECHNOLOGY_MANAGEMENT_ROLES,
} from "./Auth/roleAccess";

describe("AdminLayout user menu permissions", () => {
  it.each(["teacher", "student", undefined])(
    "hides the admin profile entry from %s",
    (roleCode) => {
      expect(canAccessAdminProfile(roleCode)).toBe(false);
    },
  );

  it.each(["admin", "super_admin"])(
    "shows the admin profile entry to %s",
    (roleCode) => {
      expect(canAccessAdminProfile(roleCode)).toBe(true);
    },
  );
});

describe("admin menu role matrix", () => {
  it("shows all menu items to super admins", () => {
    expect(getAdminMenuWhitelist("super_admin")).toBeNull();
  });

  it("shows management menus to admins", () => {
    const whitelist = getAdminMenuWhitelist("admin");

    expect(whitelist).toContain("/admin/users");
    expect(whitelist).toContain("/admin/assessment");
    expect(whitelist).toContain("/admin/it-technology");
  });

  it("limits teachers to teaching, informatics and the KNN entry", () => {
    const whitelist = getAdminMenuWhitelist("teacher");

    expect(whitelist).toContain("/admin/classroom-interaction");
    expect(whitelist).toContain("/admin/informatics");
    expect(whitelist).not.toContain("/admin/users");
    expect(whitelist).not.toContain("/admin/assessment");
    expect(whitelist).toContain("/admin/it-technology");
  });
});

describe("information technology menu destination", () => {
  it("sends teachers to KNN and preserves the selected batch", () => {
    expect(getAdminMenuTarget("teacher", "/admin/it-technology")).toBe("/admin/it-technology?view=knn");
    expect(getAdminMenuTarget("teacher", "/admin/it-technology", "?batch=synthetic&view=knn"))
      .toBe("/admin/it-technology?batch=synthetic&view=knn");
  });

  it.each(["admin", "super_admin"])("keeps the application catalog for %s", role => {
    expect(getAdminMenuTarget(role, "/admin/it-technology")).toBe("/admin/it-technology");
  });
});

describe("information technology management route permissions", () => {
  it.each(["admin", "super_admin"])("allows %s", (roleCode) => {
    expect(canAccessRoles(roleCode, IT_TECHNOLOGY_MANAGEMENT_ROLES)).toBe(true);
  });

  it.each(["teacher", "student", undefined])("rejects %s", (roleCode) => {
    expect(canAccessRoles(roleCode, IT_TECHNOLOGY_MANAGEMENT_ROLES)).toBe(false);
  });
});
