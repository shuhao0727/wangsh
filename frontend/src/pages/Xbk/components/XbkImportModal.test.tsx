import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { XbkImportModal } from "./XbkImportModal";
import { xbkDataApi } from "@services";
import type { XbkImportPreview, XbkImportResult } from "@services";
import { showMessage } from "@/lib/toast";

vi.mock("@services", () => ({
  xbkDataApi: {
    previewImport: vi.fn(),
    importData: vi.fn(),
    downloadTemplate: vi.fn(),
  },
}));
vi.mock("@/lib/toast", () => ({
  showMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const preview = (
  overrides: Partial<XbkImportPreview> = {},
): XbkImportPreview => ({
  total_rows: 1,
  valid_rows: 1,
  invalid_rows: 0,
  columns: ["姓名"],
  preview: [{ 姓名: "测试学生" }],
  errors: [],
  ...overrides,
});
const result: XbkImportResult = {
  total_rows: 1,
  processed: 1,
  inserted: 1,
  updated: 0,
  skipped: 0,
  invalid: 0,
  errors: [],
};
const file = (name = "学生.xlsx", content = "test fixture") =>
  new File([content], name);
const input = () =>
  screen.getByLabelText("选择 Excel 文件") as HTMLInputElement;
const importButton = () => screen.getByRole("button", { name: "导入" });
const choose = (value = file()) =>
  fireEvent.change(input(), { target: { files: [value] } });
const ready = async () => waitFor(() => expect(importButton()).toBeEnabled());
const setup = () => {
  const props: ComponentProps<typeof XbkImportModal> = {
    open: true,
    filters: { year: "2026-2027", term: "上学期", grade: "高一" },
    onCancel: vi.fn(),
    onSuccess: vi.fn(),
  };
  const view = render(<XbkImportModal {...props} />);
  return {
    ...view,
    props,
    update: (next: Partial<typeof props>) => {
      Object.assign(props, next);
      view.rerender(<XbkImportModal {...props} />);
    },
  };
};
// Exercise the real Radix Select instead of replacing its disabled/open behavior with a mock.
const selectOption = async (index: number, name: string) => {
  fireEvent.keyDown(screen.getAllByRole("combobox")[index], {
    key: "ArrowDown",
  });
  fireEvent.click(await screen.findByRole("option", { name }));
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(xbkDataApi.previewImport).mockResolvedValue(preview());
  vi.mocked(xbkDataApi.importData).mockResolvedValue(result);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("XBK import preview and file selection", () => {
  it("opens the native input synchronously and does not submit without a file", () => {
    setup();
    const click = vi.spyOn(input(), "click");
    fireEvent.click(screen.getByRole("button", { name: "选择 Excel 文件" }));
    expect(click).toHaveBeenCalledOnce();
    expect(input()).toHaveAttribute("accept", ".xlsx,.xls,.csv");
    expect(importButton()).toBeDisabled();
    fireEvent.click(importButton());
    expect(xbkDataApi.importData).not.toHaveBeenCalled();
  });

  it("requires a successful preview for the selected file and passes the current defaults", async () => {
    const pending = deferred<XbkImportPreview>();
    vi.mocked(xbkDataApi.previewImport).mockReturnValue(pending.promise);
    setup();
    const selected = file("学生.XLSX");
    choose(selected);
    expect(importButton()).toBeDisabled();
    expect(xbkDataApi.previewImport).toHaveBeenCalledWith({
      file: selected,
      scope: "students",
      grade: "高一",
      year: "2026-2027",
      term: "上学期",
    });
    await act(async () => pending.resolve(preview()));
    await ready();
    fireEvent.click(importButton());
    await waitFor(() =>
      expect(xbkDataApi.importData).toHaveBeenCalledWith({
        file: selected,
        scope: "students",
        grade: "高一",
        year: "2026-2027",
        term: "上学期",
        skip_invalid: true,
      }),
    );
  });

  it.each(["学生.txt", "学生.xlsx.exe", "学生"])(
    "rejects unsupported %s without contacting the API",
    async (name) => {
      setup();
      choose(file(name));
      expect(
        await screen.findByText(/仅支持 .xlsx、.xls 或 .csv 文件/),
      ).toBeInTheDocument();
      expect(xbkDataApi.previewImport).not.toHaveBeenCalled();
      expect(importButton()).toBeDisabled();
    },
  );

  it.each(["学生.csv", "兼容.xls"])(
    "previews supported %s and leaves content validation to the server",
    async (name) => {
      setup();
      const selected = file(name);
      choose(selected);
      await ready();
      expect(xbkDataApi.previewImport).toHaveBeenCalledWith(
        expect.objectContaining({ file: selected }),
      );
    },
  );

  it("shows the server conversion advice for a legacy XLS and blocks import", async () => {
    vi.mocked(xbkDataApi.previewImport).mockRejectedValueOnce({
      response: {
        data: {
          detail: "当前环境不支持旧版 .xls，请另存为 .xlsx 或 CSV 后导入",
        },
      },
    });
    setup();
    choose(file("旧版.xls"));
    expect(
      await screen.findByText(
        "当前环境不支持旧版 .xls，请另存为 .xlsx 或 CSV 后导入",
      ),
    ).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
    fireEvent.click(importButton());
    expect(xbkDataApi.importData).not.toHaveBeenCalled();
  });

  it("rejects an empty file and invalidates a previously valid preview", async () => {
    setup();
    choose();
    await ready();
    choose(file("空.xlsx", ""));
    expect(await screen.findByText(/文件为空/)).toBeInTheDocument();
    expect(screen.queryByText("测试学生")).not.toBeInTheDocument();
    expect(importButton()).toBeDisabled();
    expect(xbkDataApi.previewImport).toHaveBeenCalledTimes(1);
  });

  it("preserves the file on native picker cancellation and permits selecting the same file again", async () => {
    setup();
    const selected = file();
    choose(selected);
    await ready();
    fireEvent.change(input(), { target: { files: [] } });
    expect(screen.getByText(selected.name)).toBeInTheDocument();
    expect(importButton()).toBeEnabled();
    expect(xbkDataApi.previewImport).toHaveBeenCalledTimes(1);
    choose(selected);
    await ready();
    expect(xbkDataApi.previewImport).toHaveBeenCalledTimes(2);
  });

  it("does not permit import after preview failure, and can recover by reselecting the file", async () => {
    vi.mocked(xbkDataApi.previewImport).mockRejectedValueOnce({
      response: { data: { detail: "缺少学号列" } },
    });
    setup();
    const selected = file();
    choose(selected);
    expect(await screen.findByText("缺少学号列")).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
    fireEvent.click(importButton());
    expect(xbkDataApi.importData).not.toHaveBeenCalled();
    choose(selected);
    await ready();
    expect(screen.queryByText("缺少学号列")).not.toBeInTheDocument();
  });

  it.each([
    {
      detail: "学号重复，已阻止整份文件导入",
      text: "学号重复，已阻止整份文件导入",
    },
    {
      detail: [{ msg: "字段错误" }, { msg: "学年错误" }],
      text: "字段错误; 学年错误",
    },
    { detail: null, text: "预检失败，请检查文件或网络后重新选择文件" },
  ])(
    "renders a useful error for structured or empty server details ($text)",
    async ({ detail, text }) => {
      vi.mocked(xbkDataApi.previewImport).mockRejectedValueOnce({
        response: { data: { detail } },
      });
      setup();
      choose();
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(importButton()).toBeDisabled();
    },
  );

  it.each([0, 2])(
    "does not import a preview with zero valid rows (total=%s)",
    async (total) => {
      vi.mocked(xbkDataApi.previewImport).mockResolvedValue(
        preview({
          total_rows: total,
          valid_rows: 0,
          invalid_rows: total,
          preview: [],
        }),
      );
      setup();
      choose();
      await screen.findByText(`共 ${total} 行：可导入 0 行，错误 ${total} 行`);
      expect(importButton()).toBeDisabled();
    },
  );

  it("requires skip-invalid when preview contains invalid rows", async () => {
    vi.mocked(xbkDataApi.previewImport).mockResolvedValue(
      preview({
        total_rows: 2,
        invalid_rows: 1,
        errors: [{ row: 3, errors: ["学号缺失"] }],
      }),
    );
    setup();
    choose();
    await ready();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(importButton()).toBeDisabled();
    expect(screen.getByText(/请修正错误行/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(importButton()).toBeEnabled();
  });
});

describe("XBK import async isolation", () => {
  it("keeps a replacement file pending when the old preview resolves, then displays only the new preview", async () => {
    const old = deferred<XbkImportPreview>();
    const next = deferred<XbkImportPreview>();
    vi.mocked(xbkDataApi.previewImport)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    setup();
    choose(file("旧.xlsx"));
    choose(file("新.xlsx"));
    await act(async () =>
      old.resolve(preview({ preview: [{ 姓名: "旧学生" }] })),
    );
    expect(screen.queryByText("旧学生")).not.toBeInTheDocument();
    expect(screen.getByText("正在预检文件…")).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
    await act(async () =>
      next.resolve(preview({ preview: [{ 姓名: "新学生" }] })),
    );
    await ready();
    expect(screen.getByText("新学生")).toBeInTheDocument();
  });

  it("does not let an old successful preview authorize a replacement file whose preview failed", async () => {
    const old = deferred<XbkImportPreview>();
    vi.mocked(xbkDataApi.previewImport)
      .mockReturnValueOnce(old.promise)
      .mockRejectedValueOnce({ response: { data: { detail: "新文件无效" } } });
    setup();
    choose(file("旧.xlsx"));
    choose(file("新.xlsx"));
    await screen.findByText("新文件无效");
    await act(async () => old.resolve(preview()));
    expect(importButton()).toBeDisabled();
    expect(screen.getByText("新文件无效")).toBeInTheDocument();
    expect(screen.queryByText("测试学生")).not.toBeInTheDocument();
    fireEvent.click(importButton());
    expect(xbkDataApi.importData).not.toHaveBeenCalled();
  });

  it("does not let an old failure end the next preview's loading state", async () => {
    const old = deferred<XbkImportPreview>();
    const next = deferred<XbkImportPreview>();
    vi.mocked(xbkDataApi.previewImport)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    setup();
    choose(file("旧.xlsx"));
    choose(file("新.xlsx"));
    await act(async () => old.reject(new Error("old failure")));
    expect(screen.getByText("正在预检文件…")).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
    expect(showMessage.error).not.toHaveBeenCalled();
    await act(async () => next.resolve(preview()));
    await ready();
  });

  it("ignores an old rejection after the replacement preview succeeds", async () => {
    const old = deferred<XbkImportPreview>();
    vi.mocked(xbkDataApi.previewImport).mockReturnValueOnce(old.promise);
    setup();
    choose(file("旧.xlsx"));
    choose(file("新.xlsx"));
    await ready();
    await act(async () => old.reject(new Error("stale failure")));
    expect(importButton()).toBeEnabled();
    expect(showMessage.error).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)(
    "ignores a late %s after removing the file",
    async (outcome) => {
      const old = deferred<XbkImportPreview>();
      vi.mocked(xbkDataApi.previewImport).mockReturnValue(old.promise);
      setup();
      choose();
      fireEvent.click(screen.getByRole("button", { name: "移除" }));
      await act(async () =>
        outcome === "resolve"
          ? old.resolve(preview())
          : old.reject(new Error("old")),
      );
      expect(importButton()).toBeDisabled();
      expect(screen.queryByText("正在预检文件…")).not.toBeInTheDocument();
      expect(screen.queryByText("测试学生")).not.toBeInTheDocument();
      expect(showMessage.error).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      index: 0,
      option: "选课目录",
      expected: { scope: "courses", grade: "高一" },
    },
    {
      index: 0,
      option: "选课结果",
      expected: { scope: "selections", grade: "高一" },
    },
    {
      index: 1,
      option: "高二",
      expected: { scope: "students", grade: "高二" },
    },
    {
      index: 1,
      option: "不设置",
      expected: { scope: "students", grade: undefined },
    },
  ])(
    "isolates stale preview on switching $option",
    async ({ index, option, expected }) => {
      const old = deferred<XbkImportPreview>();
      const next = deferred<XbkImportPreview>();
      vi.mocked(xbkDataApi.previewImport)
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(next.promise);
      setup();
      choose();
      await selectOption(index, option);
      expect(xbkDataApi.previewImport).toHaveBeenLastCalledWith(
        expect.objectContaining(expected),
      );
      await act(async () => old.resolve(preview()));
      expect(importButton()).toBeDisabled();
      await act(async () => next.resolve(preview()));
      await ready();
      fireEvent.click(importButton());
      await waitFor(() =>
        expect(xbkDataApi.importData).toHaveBeenCalledWith(
          expect.objectContaining(expected),
        ),
      );
    },
  );

  it.each([{ year: "2027-2028" }, { term: "下学期" as const }])(
    "re-previews on changing external defaults %j",
    async (change) => {
      const pending = deferred<XbkImportPreview>();
      const view = setup();
      choose();
      await ready();
      vi.mocked(xbkDataApi.previewImport).mockReturnValueOnce(pending.promise);
      view.update({ filters: { ...view.props.filters, ...change } });
      expect(importButton()).toBeDisabled();
      expect(xbkDataApi.previewImport).toHaveBeenLastCalledWith(
        expect.objectContaining(change),
      );
      await act(async () => pending.resolve(preview()));
      await ready();
    },
  );

  it("clears the file on an external grade change and rejects the old preview", async () => {
    const pending = deferred<XbkImportPreview>();
    vi.mocked(xbkDataApi.previewImport).mockReturnValue(pending.promise);
    const view = setup();
    choose();
    view.update({ filters: { ...view.props.filters, grade: "高二" } });
    await act(async () => pending.resolve(preview()));
    expect(screen.queryByText("学生.xlsx")).not.toBeInTheDocument();
    expect(importButton()).toBeDisabled();
  });

  it("does not reuse a preview from a closed session after reopening", async () => {
    const old = deferred<XbkImportPreview>();
    vi.mocked(xbkDataApi.previewImport).mockReturnValueOnce(old.promise);
    const view = setup();
    choose();
    view.update({ open: false });
    view.update({ open: true });
    choose(file("重开.xlsx"));
    await ready();
    await act(async () => old.resolve(preview({ valid_rows: 0, preview: [] })));
    expect(importButton()).toBeEnabled();
    expect(screen.getByText("重开.xlsx")).toBeInTheDocument();
  });

  it("suppresses errors after unmount", async () => {
    const pending = deferred<XbkImportPreview>();
    vi.mocked(xbkDataApi.previewImport).mockReturnValueOnce(pending.promise);
    const view = setup();
    choose();
    view.unmount();
    await act(async () => pending.reject(new Error("late")));
    expect(showMessage.error).not.toHaveBeenCalled();
  });
});

describe("XBK import submission", () => {
  it("locks inputs and all close paths in flight, rejects duplicate clicks and reimport after success", async () => {
    const pending = deferred<XbkImportResult>();
    vi.mocked(xbkDataApi.importData).mockReturnValueOnce(pending.promise);
    const view = setup();
    choose();
    await ready();
    const submit = importButton();
    act(() => {
      submit.click();
      submit.click();
    });
    expect(xbkDataApi.importData).toHaveBeenCalledOnce();
    for (const name of [
      "选择 Excel 文件",
      "移除",
      "下载模板",
      "取消",
      "导入",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(input()).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    screen
      .getAllByRole("combobox")
      .forEach((control) => expect(control).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(view.props.onCancel).not.toHaveBeenCalled();
    await act(async () => pending.resolve(result));
    expect(view.props.onSuccess).toHaveBeenCalledOnce();
    expect(showMessage.success).toHaveBeenCalledOnce();
    expect(importButton()).toBeDisabled();
    fireEvent.click(importButton());
    expect(xbkDataApi.importData).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(view.props.onCancel).toHaveBeenCalledOnce();
  });

  it("shows import failure and unlocks controls for an explicit retry", async () => {
    vi.mocked(xbkDataApi.importData).mockRejectedValueOnce({
      response: { data: { detail: "没有导入权限" } },
    });
    const view = setup();
    choose();
    await ready();
    fireEvent.click(importButton());
    expect(await screen.findByText("没有导入权限")).toBeInTheDocument();
    expect(view.props.onSuccess).not.toHaveBeenCalled();
    expect(importButton()).toBeEnabled();
    expect(screen.getByRole("button", { name: "移除" })).toBeEnabled();
    fireEvent.click(importButton());
    await waitFor(() => expect(view.props.onSuccess).toHaveBeenCalledOnce());
    expect(xbkDataApi.importData).toHaveBeenCalledTimes(2);
  });

  it("does not publish an import result into an externally closed and reopened session", async () => {
    const pending = deferred<XbkImportResult>();
    vi.mocked(xbkDataApi.importData).mockReturnValueOnce(pending.promise);
    const view = setup();
    choose();
    await ready();
    fireEvent.click(importButton());
    view.update({ open: false });
    view.update({ open: true });
    expect(
      screen.getByRole("button", { name: "选择 Excel 文件" }),
    ).toBeDisabled();
    await act(async () => pending.resolve(result));
    expect(showMessage.success).not.toHaveBeenCalled();
    expect(view.props.onSuccess).not.toHaveBeenCalled();
    expect(importButton()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "选择 Excel 文件" }),
    ).toBeEnabled();
  });
});
