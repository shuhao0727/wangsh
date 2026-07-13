import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IT_GAMES_ADMIN_ROLES } from "./ITGamesAccess";
import RoleGuard from "./RoleGuard";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@hooks/useAuth", () => ({
  default: mockUseAuth,
}));

const LoginLocation = () => {
  const location = useLocation();
  return React.createElement("div", null, `login${location.search}`);
};

const renderGameManagerRoute = (
  initialEntry = "/admin/it-technology/games",
) =>
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: "/login",
          element: React.createElement(LoginLocation),
        }),
        React.createElement(Route, {
          path: "/admin/it-technology/games",
          element: React.createElement(
            RoleGuard,
            {
              roles: IT_GAMES_ADMIN_ROLES,
              children: React.createElement("div", null, "game manager"),
            },
          ),
        }),
      ),
    ),
  );

describe("RoleGuard for IT Games management", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it.each(["admin", "super_admin"])("allows %s", (roleCode) => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isLoggedIn: () => true,
      user: { role_code: roleCode },
    });

    renderGameManagerRoute();

    expect(screen.getByText("game manager")).toBeInTheDocument();
  });

  it("denies teachers", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isLoggedIn: () => true,
      user: { role_code: "teacher" },
    });

    renderGameManagerRoute();

    expect(screen.getByText("权限不足")).toBeInTheDocument();
    expect(screen.queryByText("game manager")).not.toBeInTheDocument();
  });

  it("redirects signed-out users back to the requested route", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isLoggedIn: () => false,
      user: null,
    });

    renderGameManagerRoute("/admin/it-technology/games?tab=logs");

    expect(screen.getByText(
      "login?redirect=%2Fadmin%2Fit-technology%2Fgames%3Ftab%3Dlogs",
    )).toBeInTheDocument();
  });
});
