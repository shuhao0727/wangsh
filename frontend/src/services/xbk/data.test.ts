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

  it.each(["students", "courses", "selections"] as const)(
    "forwards identical preview/import defaults for %s",
    async (scope) => {
      const file = new File(["test"], "roster.xlsx");
      const params = {
        scope,
        year: "2026-2027",
        term: "上学期",
        grade: "高一",
        file,
      };
      await xbkDataApi.previewImport(params);
      await xbkDataApi.importData({ ...params, skip_invalid: false });
      const calls = vi.mocked(api.client.post).mock.calls;
      expect(calls[0][0]).toBe("/xbk/import/preview");
      expect(calls[0][2]?.params).toEqual({
        scope,
        year: "2026-2027",
        term: "上学期",
        grade: "高一",
      });
      expect(calls[1][2]?.params).toEqual({
        scope,
        year: "2026-2027",
        term: "上学期",
        grade: "高一",
        skip_invalid: false,
      });
      expect((calls[0][1] as FormData).get("file")).toBe(file);
      expect((calls[1][1] as FormData).get("file")).toBe(file);
    },
  );

  it("sends the R3 workbook preview contract as multipart form data", async () => {
    const file = new File(["preview"], "course-selection.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const response = {
      plan_id: "plan-preview",
      preview_token: "header.payload.signature",
      token_version: 1,
      expires_at: "2026-09-15T01:00:00Z",
      year: "2026-2027",
      term: "上学期",
      baseline_id: "baseline-1",
      total_rows: 2,
      changed: 1,
      unchanged: 1,
      changed_rows: [
        {
          sheet: "高一1班",
          row: 8,
          grade: "高一",
          class_name: "1班",
          student_no: "S001",
          name: "测试学生",
          baseline_course: "C01",
          submitted_course: "C02",
          target_course: "C02",
          action: "select" as const,
        },
      ],
      notice: "预览不预留名额；确认时将重新鉴权并按数据库当前状态整批校验。",
    };
    vi.mocked(api.client.post).mockResolvedValueOnce({ data: response });

    const result = await xbkDataApi.previewCourseSelectionWorkbook({
      year: "2026-2027",
      term: "上学期",
      file,
    });

    expect(api.client.post).toHaveBeenCalledTimes(1);
    const [path, body, config] = vi.mocked(api.client.post).mock.calls[0];
    expect(path).toBe("/xbk/course-selection-workbook/preview");
    expect(config).toBeUndefined();
    expect(body).toBeInstanceOf(FormData);
    expect(Array.from((body as FormData).keys())).toEqual([
      "year",
      "term",
      "file",
    ]);
    expect((body as FormData).get("year")).toBe("2026-2027");
    expect((body as FormData).get("term")).toBe("上学期");
    expect((body as FormData).get("file")).toBe(file);
    expect(result).toBe(response);
  });

  it("sends the R3 workbook confirmation contract as multipart form data", async () => {
    const file = new File(["confirm"], "course-selection.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const response = {
      plan_id: "plan-confirm",
      status: "already_applied" as const,
      changed: 0,
      inserted: 0,
      updated: 0,
    };
    vi.mocked(api.client.post).mockResolvedValueOnce({ data: response });

    const result = await xbkDataApi.confirmCourseSelectionWorkbook({
      year: "2026-2027",
      term: "上学期",
      file,
      preview_token: "header.payload.signature",
    });

    expect(api.client.post).toHaveBeenCalledTimes(1);
    const [path, body, config] = vi.mocked(api.client.post).mock.calls[0];
    expect(path).toBe("/xbk/course-selection-workbook/confirm");
    expect(config).toBeUndefined();
    expect(body).toBeInstanceOf(FormData);
    expect(Array.from((body as FormData).keys())).toEqual([
      "year",
      "term",
      "preview_token",
      "file",
    ]);
    expect((body as FormData).get("year")).toBe("2026-2027");
    expect((body as FormData).get("term")).toBe("上学期");
    expect((body as FormData).get("preview_token")).toBe(
      "header.payload.signature",
    );
    expect((body as FormData).get("file")).toBe(file);
    expect(result).toBe(response);
  });

  it("forwards the selected grade to KPI summary", async () => {
    const params = {
      year: "2026-2027",
      term: "上学期",
      grade: "高二",
      class_name: "2班",
    };
    await xbkDataApi.getSummary(params);
    expect(api.client.get).toHaveBeenCalledWith("/xbk/analysis/summary", {
      params,
    });
  });
});
