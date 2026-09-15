import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthenticatedGuard from "./AuthenticatedGuard";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@hooks/useAuth", () => ({
  default: mockUseAuth,
}));

const LoginLocation = () => {
  const location = useLocation();
  return <div>{`login${location.search}`}</div>;
};

const renderProtectedRoute = (initialEntry = "/ai-agents") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginLocation />} />
        <Route
          path="/ai-agents"
          element={
            <AuthenticatedGuard>
              <div>agent chat</div>
            </AuthenticatedGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe("AuthenticatedGuard", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("redirects guest mode to login and preserves the requested URL", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isLoggedIn: () => false,
      user: null,
    });

    renderProtectedRoute("/ai-agents?agent=7#chat");

    expect(
      screen.getByText("login?redirect=%2Fai-agents%3Fagent%3D7%23chat"),
    ).toBeInTheDocument();
    expect(screen.queryByText("agent chat")).not.toBeInTheDocument();
  });

  it.each(["student", "teacher", "admin", "super_admin"])(
    "allows logged-in %s users",
    (roleCode) => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: () => true,
        user: { role_code: roleCode },
      });

      renderProtectedRoute();

      expect(screen.getByText("agent chat")).toBeInTheDocument();
    },
  );

  it("does not allow a historical guest-role account", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isLoggedIn: () => true,
      user: { role_code: "guest" },
      logout,
    });

    renderProtectedRoute();

    expect(screen.getByText("访客模式不能使用智能体对话")).toBeInTheDocument();
    expect(screen.queryByText("agent chat")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "退出并登录" }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("login?redirect=%2Fai-agents"),
    ).toBeInTheDocument();
  });
});
