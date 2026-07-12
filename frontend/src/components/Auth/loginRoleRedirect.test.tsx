import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@hooks/useAuth";
import LoginPage from "@/pages/Auth/Login";

const { login, getCurrentUser } = vi.hoisted(() => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@services", () => ({
  authApi: {
    login,
    getCurrentUser,
    logout: vi.fn(),
  },
}));

vi.mock("@services/api", () => ({
  AUTH_EXPIRED_EVENT: "ws:auth-expired",
  clearPersistedAuthExpiredDetail: vi.fn(),
  extractAuthErrorDetail: vi.fn(() => ""),
  getPersistedAuthExpiredDetail: vi.fn(() => null),
  getStoredAccessToken: vi.fn(() => null),
  getCookieToken: vi.fn(() => null),
  notifyAuthExpired: vi.fn(),
}));

vi.mock("@/components/Auth/AnimatedLoginCharacters", () => ({
  default: () => null,
}));

vi.mock("@/lib/toast", () => ({
  showMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderLogin = (initialEntry = "/login") =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

describe("login role redirect", () => {
  beforeEach(() => {
    login.mockReset();
    getCurrentUser.mockReset();
    login.mockResolvedValue({ data: { access_token: "test-token" } });
  });

  it.each([
    ["admin", "/admin/dashboard"],
    ["super_admin", "/admin/dashboard"],
    ["teacher", "/admin/classroom-interaction"],
    ["student", "/home"],
  ])("routes %s to its default landing page", async (roleCode, expectedPath) => {
    getCurrentUser.mockResolvedValue({
      data: {
        id: 1,
        role_code: roleCode,
        username: `${roleCode}-test`,
        student_id: "A001",
        full_name: `${roleCode} Test`,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("用户名"), "admin-test");
    await user.type(screen.getByLabelText("密码"), "A001");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(expectedPath),
    );
  });

  it("preserves an explicit protected deep-link redirect for staff", async () => {
    getCurrentUser.mockResolvedValue({
      data: {
        id: 1,
        role_code: "admin",
        username: "admin-test",
        student_id: "A001",
        full_name: "Admin Test",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    });
    const user = userEvent.setup();
    renderLogin("/login?redirect=%2Ftask-analysis%2Fnew%3Ftype%3Dhot");

    await user.type(screen.getByLabelText("用户名"), "admin-test");
    await user.type(screen.getByLabelText("密码"), "A001");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/task-analysis/new?type=hot",
      ),
    );
  });
});
