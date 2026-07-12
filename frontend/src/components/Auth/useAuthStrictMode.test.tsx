import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useAuth, { AuthProvider } from "@hooks/useAuth";

const { getCurrentUser } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@services", () => ({
  authApi: {
    getCurrentUser,
    login: vi.fn(),
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

const AuthStateProbe = () => {
  const auth = useAuth();
  return <div>{auth.isLoading ? "loading" : "ready"}</div>;
};

describe("AuthProvider in React StrictMode", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    getCurrentUser.mockReset();
    window.history.replaceState({}, "", "/admin/dashboard");
    let attempt = 0;
    getCurrentUser.mockImplementation(({ signal }: { signal?: AbortSignal } = {}) => {
      attempt += 1;
      if (attempt === 1) {
        return new Promise((_, reject) => {
          signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }));
          });
        });
      }
      return Promise.reject({
        response: { status: 401, data: { detail: "未提供认证令牌" } },
      });
    });
  });

  it("retries the initial session probe after the StrictMode cleanup cancels it", async () => {
    render(
      <React.StrictMode>
        <AuthProvider>
          <AuthStateProbe />
        </AuthProvider>
      </React.StrictMode>,
    );

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
  });

  it("finishes loading when the initial session probe times out", async () => {
    vi.useFakeTimers();
    getCurrentUser.mockImplementation(() => new Promise(() => {}));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("probes an HttpOnly cookie session on task-analysis deep links", async () => {
    window.history.replaceState({}, "", "/task-analysis/new?type=hot");
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

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
  });
});
