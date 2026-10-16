import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicTypstNotesApi } from "./publicTypstNotes";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api", () => ({ api: { get: mocks.get } }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("Blob", NodeBlob); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("public PDF export contract", () => {
  it("keeps PDF bytes and the explicit cache key with a no-cache public request", async () => {
    const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    mocks.get.mockResolvedValueOnce({ data: blob });
    expect(await publicTypstNotesApi.exportPdf(42, "source-version")).toBe(blob);
    expect(mocks.get).toHaveBeenCalledWith("/public/informatics/typst-notes/42/export.pdf", {
      params: { v: "source-version" }, responseType: "blob", headers: { "Cache-Control": "no-cache" },
    });
  });
  it.each([
    ["JSON detail", '{"detail":"PDF 暂未生成，请联系管理员编译"}', "PDF 暂未生成，请联系管理员编译"],
    ["plain text", "upstream PDF not available", "upstream PDF not available"],
    ["empty body", "", "导出失败"],
  ])("shows the actual %s error rather than swallowing it", async (_, body, message) => {
    mocks.get.mockRejectedValueOnce({ response: { data: new Blob([body]) } });
    await expect(publicTypstNotesApi.exportPdf(42)).rejects.toThrow(message);
  });
  it("preserves errors that are not a Blob response", async () => {
    const error = new Error("network interrupted");
    mocks.get.mockRejectedValueOnce(error);
    await expect(publicTypstNotesApi.exportPdf(42)).rejects.toBe(error);
  });
});
