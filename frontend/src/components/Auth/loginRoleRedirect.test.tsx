import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@hooks/useAuth";
import LoginPage from "@/pages/Auth/Login";
import { showMessage } from "@/lib/toast";
import { resolveLoginDestination } from "@/utils/loginDestination";
import RoleGuard from "./RoleGuard";

const { login, logout, getCurrentUser, getStoredAccessToken } = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  getStoredAccessToken: vi.fn(),
}));

vi.mock("@services", () => ({
  authApi: { login, logout, getCurrentUser },
}));

vi.mock("@services/api", () => ({
  subscribeAuthIdentityChange: vi.fn(() => () => {}),
  AUTH_EXPIRED_EVENT: "ws:auth-expired",
  clearPersistedAuthExpiredDetail: vi.fn(),
  extractAuthErrorDetail: vi.fn(() => ""),
  getPersistedAuthExpiredDetail: vi.fn(() => null),
  getStoredAccessToken,
  getCookieToken: vi.fn(() => null),
  notifyAuthExpired: vi.fn(),
}));

vi.mock("@/components/Auth/AnimatedLoginCharacters", () => ({
  default: () => null,
}));

vi.mock("@/lib/toast", () => ({
  showMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), destroy: vi.fn() },
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}{location.hash}</div>;
};

const renderLogin = (initialEntry = "/login") =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/only-admin" element={
            <RoleGuard roles={["admin", "super_admin"]}>
              <LocationProbe />
            </RoleGuard>
          } />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

const setRole = (roleCode: string) => getCurrentUser.mockResolvedValue({
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

const submitLogin = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/用户名|管理员账号/), "test-user");
  await user.type(screen.getByLabelText("密码"), "A001");
  await user.click(screen.getByRole("button", { name: /^(管理员)?登录$/ }));
};

const expectDestination = async (path: string) => {
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe(path));
};

describe("login destination safety", () => {
  it.each([
    null, "", "home", "https://example.com", "//example.com", "///example.com",
    "javascript:alert(1)", "/\\example.com", "/home\\..\\admin", "/\n/example.com",
    "/\t/example.com", "/home\r", "/home\u0000", "/home\u007f",
    "/..//example.com",
  ])("falls back to home for %j", (redirect) => {
    expect(resolveLoginDestination(redirect)).toBe("/home");
  });

  it.each([
    "/home", "/admin/dashboard?tab=logs#recent", "/task-analysis/new?type=hot#form",
    "/articles?q=%E6%95%99%E5%AD%A6%20test#section",
  ])("preserves explicit local destination %s", (redirect) => {
    expect(resolveLoginDestination(redirect)).toBe(redirect);
  });

  it("preserves query values containing spaces", () => {
    expect(resolveLoginDestination("/articles?q=hello world#results"))
      .toBe("/articles?q=hello%20world#results");
  });

  it("normalizes dot segments before the admin permission check", () => {
    expect(resolveLoginDestination("/home/../admin/dashboard")).toBe("/admin/dashboard");
    expect(resolveLoginDestination("/home/%2e%2e/admin/dashboard")).toBe("/admin/dashboard");
  });
});

describe("login role redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStoredAccessToken.mockReturnValue(null);
    login.mockResolvedValue({ data: { access_token: "test-token" } });
    logout.mockResolvedValue(undefined);
  });

  describe.each(["admin", "super_admin", "teacher", "student"])("%s", (roleCode) => {
    it.each(["/login", "/login?redirect=%2Fhome", "/login?redirect=%2F%5Cexample.com"])(
      "lands at home after form login from %s", async (entry) => {
        setRole(roleCode);
        renderLogin(entry);
        await submitLogin();
        await expectDestination("/home");
      },
    );

    it.each(["/login", "/login?redirect=%2Fhome"])(
      "lands at home with an existing session from %s", async (entry) => {
        setRole(roleCode);
        getStoredAccessToken.mockReturnValue("existing-test-token");
        renderLogin(entry);
        await expectDestination("/home");
        expect(login).not.toHaveBeenCalled();
      },
    );
  });

  it.each(["admin", "super_admin", "teacher"])(
    "preserves explicit admin deep links for %s", async (roleCode) => {
      setRole(roleCode);
      const destination = "/admin/classroom-interaction?tab=logs#recent";
      renderLogin(`/login?redirect=${encodeURIComponent(destination)}`);
      await submitLogin();
      await expectDestination(destination);
      expect(logout).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])("preserves other protected deep links (existing session: %s)", async (existing) => {
    setRole("admin");
    if (existing) getStoredAccessToken.mockReturnValue("existing-test-token");
    const destination = "/task-analysis/new?type=hot#form";
    renderLogin(`/login?redirect=${encodeURIComponent(destination)}`);
    if (!existing) await submitLogin();
    await expectDestination(destination);
  });

  it.each([false, true])("rejects student admin access (existing session: %s)", async (existing) => {
    setRole("student");
    if (existing) getStoredAccessToken.mockReturnValue("existing-test-token");
    renderLogin("/login?redirect=%2Fhome%2F..%2Fadmin%2Fdashboard");
    if (!existing) await submitLogin();
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(showMessage.warning).toHaveBeenCalledWith("当前账号没有管理后台权限");
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("does not bypass the destination role guard for teachers", async () => {
    setRole("teacher");
    renderLogin("/login?redirect=%2Fadmin%2Fonly-admin");
    await submitLogin();
    await screen.findByText("当前角色无权访问此页面");
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("does not navigate when login fails", async () => {
    login.mockRejectedValue({ response: { data: { detail: "账号或密码错误" } } });
    renderLogin();
    await submitLogin();
    await waitFor(() => expect(showMessage.error).toHaveBeenCalledWith("账号或密码错误"));
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });
});
