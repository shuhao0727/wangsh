import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, authTokenStorage } from "@/services/api";
import {
  fetchLearningChapters,
  fetchLearningContent,
  fetchLearningContentPayload,
  loadLearningBook,
} from "@/pages/Admin/ITTechnology/learning/helpers";

vi.mock("@services", async () => ({ api: (await import("@/services/api")).api }));
vi.mock("@/services/config", () => ({
  config: { apiUrl: "https://learning-auth.invalid/api/v1", features: { debug: false } },
}));
vi.mock("@/services/logger", () => ({ logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const items = [{ section_key: "raw", item_key: "book", enabled: true, content: {
  book: { moduleKey: "ml", title: "Remote fixture", chapters: [{
    slug: "auth-fixture", title: "Remote chapter", markdown: "RAW-REMOTE", goals: ["retained"],
  }] },
} }];
const chapters = [{ slug: "auth-fixture", title: "Canonical chapter", markdown: "SYS-REMOTE" }];
let requests: InternalAxiosRequestConfig[];
let adapter: typeof api.client.defaults.adapter;
let status: number;
const response = (config: InternalAxiosRequestConfig, data: unknown, code = 200): AxiosResponse => ({
  config, data, status: code, statusText: String(code), headers: new AxiosHeaders(),
});

beforeEach(() => {
  requests = [];
  status = 200;
  localStorage.clear();
  sessionStorage.clear();
  authTokenStorage.set("synthetic-learning-access");
  adapter = api.client.defaults.adapter;
  api.client.defaults.adapter = (async (config) => {
    requests.push(config);
    const data = config.url?.includes("/content/") ? items : chapters;
    const res = response(config, data, status);
    if (status >= 400) throw new AxiosError(`HTTP ${status}`, AxiosError.ERR_BAD_RESPONSE, config, {}, res);
    return res;
  }) satisfies AxiosAdapter;
  // No Cookie transport: reproduce the old readers' missing Bearer without network access.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
});
afterEach(() => {
  api.client.defaults.adapter = adapter;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("learning content uses the shared authenticated transport without Cookie availability", () => {
  it.each(["ml", "ai", "agents"] as const)("reads %s content and chapters with Bearer, credentials and the caller signal", async module => {
    const controller = new AbortController();
    await expect(fetchLearningContent(module, controller.signal)).resolves.toEqual(items);
    await expect(fetchLearningChapters(module, controller.signal)).resolves.toEqual(chapters);
    expect(requests.map(r => r.url)).toEqual([`/learning/content/${module}`, `/learning/chapters/${module}`]);
    for (const request of requests) {
      expect(request.headers.get("Authorization")).toBe("Bearer synthetic-learning-access");
      expect(request.withCredentials).toBe(true);
      expect(request.signal).toBe(controller.signal);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps canonical chapter precedence and metadata on the authenticated editor load", async () => {
    const controller = new AbortController();
    const resolved = await loadLearningBook("ml", controller.signal);
    expect(resolved.canSave).toBe(true);
    expect(resolved.book.chapters[0]).toMatchObject({
      slug: "auth-fixture", title: "Canonical chapter", markdown: "SYS-REMOTE", goals: ["retained"],
    });
    expect(requests).toHaveLength(2);
    expect(requests.every(r => r.signal === controller.signal)).toBe(true);
  });

  it("uses refreshed credentials instead of falling back to bundled content after an expired Bearer", async () => {
    api.client.defaults.adapter = (async config => {
      requests.push(config);
      if (config.url === "/auth/refresh") return response(config, { access_token: "synthetic-learning-refreshed" });
      if (config.headers.get("Authorization") === "Bearer synthetic-learning-access") {
        throw new AxiosError("HTTP 401", AxiosError.ERR_BAD_RESPONSE, config, {}, response(config, { detail: "expired" }, 401));
      }
      return response(config, items);
    }) satisfies AxiosAdapter;
    await expect(fetchLearningContent("ml")).resolves.toEqual(items);
    const contentReads = requests.filter(r => r.url === "/learning/content/ml");
    expect(contentReads).toHaveLength(2);
    expect(contentReads[1].headers.get("Authorization")).toBe("Bearer synthetic-learning-refreshed");
    expect(requests.filter(r => r.url === "/auth/refresh")).toHaveLength(1);
  });

  it("does not mark fallback editor content saveable after a source503", async () => {
    status = 503;
    const resolved = await loadLearningBook("ml");
    expect(resolved.canSave).toBe(false);
    await expect(fetchLearningContentPayload("ml")).resolves.toBeNull();
  });

  it("honors an already aborted signal without dispatching either source request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchLearningContent("ml", controller.signal)).resolves.toBeNull();
    await expect(fetchLearningChapters("ml", controller.signal)).resolves.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it("discards a successful response that arrives after the reader signal was aborted", async () => {
    let reply!: () => void;
    api.client.defaults.adapter = (config => new Promise(resolve => {
      requests.push(config);
      reply = () => resolve(response(config, items));
    })) satisfies AxiosAdapter;
    const controller = new AbortController();
    const pending = fetchLearningContent("ml", controller.signal);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    controller.abort();
    reply();
    await expect(pending).resolves.toBeNull();
    expect(requests[0].signal?.aborted).toBe(true);
  });
});
