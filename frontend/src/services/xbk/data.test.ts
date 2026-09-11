import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { xbkDataApi } from "./data";

vi.mock("../api", () => ({ api: { client: { post: vi.fn(), get: vi.fn() } } }));

describe("XBK request contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.client.post).mockResolvedValue({ data: {} });
    vi.mocked(api.client.get).mockResolvedValue({ data: {} });
  });

  it.each(["students", "courses", "selections"] as const)("forwards identical preview/import defaults for %s", async (scope) => {
    const file = new File(["test"], "roster.xlsx");
    const params = { scope, year: "2026-2027", term: "上学期", grade: "高一", file };
    await xbkDataApi.previewImport(params);
    await xbkDataApi.importData({ ...params, skip_invalid: false });
    const calls = vi.mocked(api.client.post).mock.calls;
    expect(calls[0][0]).toBe("/xbk/import/preview");
    expect(calls[0][2]?.params).toEqual({ scope, year: "2026-2027", term: "上学期", grade: "高一" });
    expect(calls[1][2]?.params).toEqual({ scope, year: "2026-2027", term: "上学期", grade: "高一", skip_invalid: false });
    expect((calls[0][1] as FormData).get("file")).toBe(file);
    expect((calls[1][1] as FormData).get("file")).toBe(file);
  });

  it("forwards the selected grade to KPI summary", async () => {
    const params = { year: "2026-2027", term: "上学期", grade: "高二", class_name: "2班" };
    await xbkDataApi.getSummary(params);
    expect(api.client.get).toHaveBeenCalledWith("/xbk/analysis/summary", { params });
  });
});
