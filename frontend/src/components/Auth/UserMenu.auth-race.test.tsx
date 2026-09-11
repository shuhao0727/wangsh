import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { api, authTokenStorage } from "@services/api";
import useAuth, { AuthProvider } from "@hooks/useAuth";
import UserMenu from "./UserMenu";

vi.mock("@services/config", () => ({ config: { apiUrl: "https://auth-race.invalid/api/v1", features: { debug: false } } }));
vi.mock("@services/logger", () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@services", async () => ({ authApi: (await import("@services/api")).authApi }));
const user = (id: number) => ({ id, username: `user-${id}`, full_name: `User ${id}`, role_code: "admin", is_active: true });
let pending: Array<{ url: string; reply: (status: number, data?: unknown) => void }>;
let controller: ReturnType<typeof useAuth>;
let navigate: ReturnType<typeof useNavigate>;
const Probe = () => {
  controller = useAuth();
  navigate = useNavigate();
  return <><span data-testid="identity">{controller.user?.id ?? "guest"}</span><span data-testid="path">{useLocation().pathname}</span><UserMenu mode="button" /><Toaster /></>;
};
const next = async (url: string) => {
  await waitFor(() => expect(pending.some(p => p.url === url)).toBe(true));
  return pending.splice(pending.findIndex(p => p.url === url), 1)[0];
};
const mount = async () => {
  render(<MemoryRouter initialEntries={["/home"]}><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
  const me = await next("/auth/me");
  await act(async () => me.reply(200, user(1)));
  await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent("1"));
};
const clickLogout = async () => {
  fireEvent.pointerDown(screen.getByRole("button", { name: /user-1/ }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole("menuitem", { name: "退出登录" }));
  return next("/auth/logout");
};
const loginB = async () => {
  let result!: ReturnType<typeof controller.login>;
  act(() => { result = controller.login("B", "synthetic"); });
  const login = await next("/auth/login");
  await act(async () => login.reply(200, { access_token: "B" }));
  const me = await next("/auth/me");
  await act(async () => { me.reply(200, user(2)); await result; });
  act(() => { void navigate("/admin/dashboard"); });
};
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); pending = [];
  window.history.replaceState({}, "", "/home");
  authTokenStorage.set("A");
  api.client.defaults.adapter = config => new Promise((resolve, reject) => {
    pending.push({ url: config.url!, reply(status, data = {}) {
      const response: AxiosResponse = { config, data, status, statusText: String(status), headers: new AxiosHeaders() };
      if (status >= 400) reject(new AxiosError(`HTTP ${status}`, AxiosError.ERR_BAD_RESPONSE, config, {}, response));
      else resolve(response);
    } });
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("UserMenu and real AuthProvider identity races", () => {
  it("shows logout503 as an incomplete server revocation, with local identity cleared", async () => {
    await mount(); const logout = await clickLogout();
    await act(async () => logout.reply(503, { detail: "synthetic revocation failure" }));
    expect(screen.getByTestId("identity")).toHaveTextContent("guest");
    expect(await screen.findByText(/服务端会话撤销未确认/)).toBeVisible();
    expect(screen.getByTestId("path")).toHaveTextContent("/login");
  });
  it.each([200, 503])("navigates immediately, never when the old logout %s settles after B", async status => {
    await mount(); const logout = await clickLogout();
    expect(screen.getByTestId("path")).toHaveTextContent("/login");
    await loginB();
    await act(async () => logout.reply(status));
    expect(screen.getByTestId("identity")).toHaveTextContent("2");
    expect(localStorage.getItem("ws_access_token")).toBe("B");
    expect(screen.getByTestId("path")).toHaveTextContent("/admin/dashboard");
    expect(screen.queryByText(/服务端会话撤销未确认/)).not.toBeInTheDocument();
  });
  it("clears A immediately on cross-tab login and only publishes verified B me", async () => {
    await mount();
    act(() => {
      localStorage.setItem("ws_access_token", "B");
      window.dispatchEvent(new StorageEvent("storage", { key: "ws_access_token", storageArea: localStorage }));
    });
    expect(screen.getByTestId("identity")).toHaveTextContent("guest");
    const me = await next("/auth/me");
    await act(async () => me.reply(200, user(2)));
    expect(screen.getByTestId("identity")).toHaveTextContent("2");
  });
  it("clears cross-tab logout without probing a possibly surviving HttpOnly cookie", async () => {
    await mount();
    act(() => {
      localStorage.removeItem("ws_access_token");
      window.dispatchEvent(new StorageEvent("storage", { key: "ws_access_token", storageArea: localStorage }));
    });
    expect(screen.getByTestId("identity")).toHaveTextContent("guest");
    expect(pending).toHaveLength(0);
  });
});


it.each(["signed-out", "pending"])("a newly mounted protected tab does not restore cookies during %s intent", async phase => {
  localStorage.removeItem("ws_access_token");
  localStorage.setItem("ws_auth_identity", JSON.stringify({ id: "prior-tab-intent", phase }));
  window.history.replaceState({}, "", "/admin/dashboard");
  render(<MemoryRouter initialEntries={["/admin/dashboard"]}><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
  await act(async () => { for (let i = 0; i < 30; i += 1) await Promise.resolve(); });
  expect(screen.getByTestId("identity")).toHaveTextContent("guest");
  expect(controller.isLoading).toBe(false);
  expect(pending).toHaveLength(0);
});
