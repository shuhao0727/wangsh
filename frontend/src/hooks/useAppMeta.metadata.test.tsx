import { StrictMode, createContext, useContext } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  config: {} as { version?: string | null; env?: string | null },
  get: vi.fn(),
}));

vi.mock("@services/config", () => ({ default: fixtures.config }));
vi.mock("@services", () => ({ api: { get: fixtures.get } }));
vi.mock("@services/logger", () => ({ logger: { debug: vi.fn() } }));

let fetchSpy: ReturnType<typeof vi.fn>;
let xhrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  fixtures.config.version = "1.6.0";
  fixtures.config.env = "production";
  fixtures.get.mockReset().mockRejectedValue(new Error("403: metadata cannot use privileged APIs"));
  fetchSpy = vi.fn().mockRejectedValue(new Error("Unexpected metadata fetch"));
  vi.stubGlobal("fetch", fetchSpy);
  xhrSpy = vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(() => {
    throw new Error("Unexpected metadata XHR");
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function expectNoRequests() {
  expect(fixtures.get, "metadata must not request system APIs").not.toHaveBeenCalled();
  expect(fetchSpy, "metadata must not fetch").not.toHaveBeenCalled();
  expect(xhrSpy, "metadata must not send XHR").not.toHaveBeenCalled();
}

describe("useAppMeta local build metadata", () => {
  it.each([
    ["1.6.0", "1.6.0"],
    ["  r3-build+abc  ", "r3-build+abc"],
    ["unknown", "–"],
    [" UnKnOwN ", "–"],
    ["", "–"],
    ["   ", "–"],
    [null, "–"],
    [undefined, "–"],
  ])("normalizes version %j locally as %s", async (version, expected) => {
    fixtures.config.version = version;
    const { useAppMeta } = await import("@hooks/useAppMeta");
    const { result } = renderHook(() => useAppMeta());
    expect(result.current).toEqual({ version: expected, envLabel: "生产环境" });
    await flushEffects();
    expectNoRequests();
  });

  it.each([
    ["development", "本地开发"],
    ["production", "生产环境"],
    ["test", "测试环境"],
    [" staging ", "staging"],
    ["", "本地开发"],
    ["  ", "本地开发"],
    [null, "本地开发"],
    [undefined, "本地开发"],
  ])("keeps environment label %j as %s", async (env, expected) => {
    fixtures.config.env = env;
    const { useAppMeta } = await import("@hooks/useAppMeta");
    const { result } = renderHook(() => useAppMeta());
    await flushEffects();
    expect(result.current.envLabel).toBe(expected);
    expectNoRequests();
  });

  it("handles absent configuration fields without an API fallback", async () => {
    delete fixtures.config.version;
    delete fixtures.config.env;
    const { default: useAppMeta } = await import("@hooks/useAppMeta");
    const { result } = renderHook(() => useAppMeta());
    await flushEffects();
    expect(result.current).toEqual({ version: "–", envLabel: "本地开发" });
    expectNoRequests();
  });

  it("never requests metadata even when privileged endpoints could return a version", async () => {
    fixtures.get.mockResolvedValue({ data: { version: "private-server-version" } });
    const { useAppMeta } = await import("@hooks/useAppMeta");
    const { result } = renderHook(() => useAppMeta());
    await flushEffects();
    expectNoRequests();
    expect(result.current.version).toBe("1.6.0");
  });

  it("supports simultaneous Home/Admin consumers, rerenders and StrictMode remounts", async () => {
    const { useAppMeta } = await import("@hooks/useAppMeta");
    const { result, rerender, unmount } = renderHook(
      () => ({ home: useAppMeta(), admin: useAppMeta() }),
      { wrapper: StrictMode },
    );
    await flushEffects();
    expect(result.current.home).toEqual({ version: "1.6.0", envLabel: "生产环境" });
    expect(result.current.admin).toEqual(result.current.home);
    rerender();
    unmount();
    const remounted = renderHook(() => useAppMeta(), { wrapper: StrictMode });
    await flushEffects();
    expect(remounted.result.current).toEqual({ version: "1.6.0", envLabel: "生产环境" });
    expectNoRequests();
  });

  it("does not cache privileged data across super-admin/admin/student/anonymous transitions", async () => {
    const Identity = createContext("super_admin");
    let role = "super_admin";
    fixtures.get.mockImplementation(async () => ({ data: { version: `private-${role}` } }));
    const { useAppMeta } = await import("@hooks/useAppMeta");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Identity.Provider value={role}>{children}</Identity.Provider>
    );
    const { result, rerender, unmount } = renderHook(
      () => ({ role: useContext(Identity), meta: useAppMeta() }),
      { wrapper },
    );
    for (role of ["super_admin", "admin", "student", "anonymous", "admin"]) {
      rerender();
      await flushEffects();
      expect(result.current.role).toBe(role);
      expect(result.current.meta).toEqual({ version: "1.6.0", envLabel: "生产环境" });
    }
    unmount();
    role = "anonymous";
    const remounted = renderHook(() => useAppMeta(), { wrapper });
    await flushEffects();
    expect(remounted.result.current).toEqual({ version: "1.6.0", envLabel: "生产环境" });
    expectNoRequests();
  });
});
