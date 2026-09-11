import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { xbkDataApi } from "@services";
import { showMessage } from "@/lib/toast";
import { XbkExportModal } from "./XbkExportModal";

vi.mock("@services", () => ({ xbkDataApi: { exportTables: vi.fn() } }));
vi.mock("@/lib/toast", () => ({
  showMessage: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

type Props = ComponentProps<typeof XbkExportModal>;
const setup = (
  filters: Props["filters"] = {
    year: "2027-2028",
    term: "下学期",
    grade: "高二",
    class_name: "2",
  },
) => {
  const props: Props = { open: true, filters, onCancel: vi.fn() };
  const view = render(<XbkExportModal {...props} />);
  return {
    ...view,
    props,
    update: (next: Partial<Props>) => {
      Object.assign(props, next);
      view.rerender(<XbkExportModal {...props} />);
    },
  };
};
const submit = () => screen.getByRole("button", { name: "导出" });
const selectType = async (name: string) => {
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name }));
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const workbook = () =>
  new Blob(["xlsx"], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
const errorBlob = (text: string) => {
  const blob = new Blob([text], { type: "application/json" });
  Object.defineProperty(blob, "text", {
    value: vi.fn().mockResolvedValue(text),
  });
  return blob;
};

let downloads: HTMLAnchorElement[];
beforeEach(() => {
  vi.resetAllMocks();
  downloads = [];
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:xbk-export");
      static revokeObjectURL = vi.fn();
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function (this: HTMLAnchorElement) {
      downloads.push(this);
    },
  );
  vi.mocked(xbkDataApi.exportTables).mockResolvedValue(workbook());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("XBK export filters", () => {
  it.each([
    { year: undefined, term: "上学期" as const },
    { year: "2027-2028", term: undefined },
    { year: undefined, term: undefined },
  ])("blocks missing required filters %j", (filters) => {
    setup(filters);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "请选择具体的学年和学期",
    );
    expect(submit()).toBeDisabled();
    expect(screen.queryByPlaceholderText("起")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("止")).not.toBeInTheDocument();
    expect(xbkDataApi.exportTables).not.toHaveBeenCalled();
  });

  it.each([
    ["学生选课表", "course-selection"],
    ["教师分发表", "teacher-distribution"],
    ["各班分发表", "distribution"],
  ])("exports %s with the exact academic-year filters", async (label, type) => {
    const view = setup();
    await selectType(label);
    fireEvent.click(submit());
    await waitFor(() => expect(view.props.onCancel).toHaveBeenCalledOnce());
    expect(xbkDataApi.exportTables).toHaveBeenCalledExactlyOnceWith({
      export_type: type,
      year: "2027-2028",
      term: "下学期",
      grade: "高二",
      class_name: "2",
    });
    expect(downloads).toHaveLength(1);
    expect(downloads[0].download).toBe(
      `xbk_${type}_2027-2028_下学期_高二.xlsx`,
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:xbk-export",
    );
  });

  it("allows cross-grade distribution export instead of forcing one grade", async () => {
    const view = setup({ year: "2026-2027", term: "上学期" });
    await selectType("各班分发表");
    fireEvent.click(submit());
    await waitFor(() => expect(view.props.onCancel).toHaveBeenCalledOnce());
    expect(xbkDataApi.exportTables).toHaveBeenCalledWith({
      export_type: "distribution",
      year: "2026-2027",
      term: "上学期",
      grade: undefined,
      class_name: undefined,
    });
    expect(showMessage.warning).not.toHaveBeenCalled();
  });

  it("locks synchronous duplicate submissions", async () => {
    const pending = deferred<Blob>();
    vi.mocked(xbkDataApi.exportTables).mockReturnValueOnce(pending.promise);
    setup();
    fireEvent.click(submit());
    fireEvent.click(submit());
    expect(xbkDataApi.exportTables).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(workbook()));
    await waitFor(() => expect(showMessage.success).toHaveBeenCalledOnce());
  });

  it("ignores an old response after filters change", async () => {
    const pending = deferred<Blob>();
    vi.mocked(xbkDataApi.exportTables).mockReturnValueOnce(pending.promise);
    const view = setup();
    fireEvent.click(submit());
    view.update({ filters: { year: "2028-2029", term: "上学期" } });
    await act(async () => pending.resolve(workbook()));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(showMessage.success).not.toHaveBeenCalled();
    expect(view.props.onCancel).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });
});

describe("XBK export errors", () => {
  it.each([
    ['{"detail":"没有可导出数据"}', "没有可导出数据"],
    [
      '{"detail":[{"msg":"学年无效"},{"msg":"学期无效"}]}',
      "学年无效; 学期无效",
    ],
    ['{"detail":{"reason":"筛选无效"}}', '{"reason":"筛选无效"}'],
    ["<html>Bad Gateway</html>", "导出失败，请检查网络或登录状态后重试"],
  ])("decodes workbook error Blob %s", async (body, message) => {
    vi.mocked(xbkDataApi.exportTables).mockRejectedValueOnce({
      response: { data: errorBlob(body) },
    });
    setup();
    fireEvent.click(submit());
    await waitFor(() => expect(showMessage.error).toHaveBeenCalledWith(message));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });

  it.each([
    [{ response: { status: 401 } }, "登录已过期，请重新登录后导出"],
    [{ response: { status: 403 } }, "没有导出权限，请使用管理员账号登录"],
    [{ response: { data: { detail: "导出参数无效" } } }, "导出参数无效"],
    [new Error("Network Error"), "导出失败，请检查网络或登录状态后重试"],
  ])("shows a useful non-Blob error", async (error, message) => {
    vi.mocked(xbkDataApi.exportTables).mockRejectedValueOnce(error);
    setup();
    fireEvent.click(submit());
    await waitFor(() => expect(showMessage.error).toHaveBeenCalledWith(message));
    expect(downloads).toHaveLength(0);
    expect(submit()).toBeEnabled();
  });
});
