import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IT_GAMES_ADMIN_ROLES,
  canManageITGameRepo,
} from "./ITGamesAccess";

describe("IT Games management access", () => {
  it("matches the backend require_admin contract", () => {
    expect(IT_GAMES_ADMIN_ROLES).toEqual(["admin", "super_admin"]);
    expect(canManageITGameRepo("admin")).toBe(true);
    expect(canManageITGameRepo("super_admin")).toBe(true);
    expect(canManageITGameRepo("teacher")).toBe(false);
    expect(canManageITGameRepo("student")).toBe(false);
  });

  it("registers the public and admin game repository routes", () => {
    const appSource = readFileSync(
      resolve(process.cwd(), "src/App.tsx"),
      "utf8",
    );

    expect(appSource).toContain('path="/it-technology/games"');
    expect(appSource).toContain('path="/admin/it-technology/games"');
    expect(appSource).toContain(
      "<RoleGuard roles={IT_GAMES_ADMIN_ROLES}>",
    );
  });
});
