import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import XbkPage from "./index";
import { getCurrentAcademicYear } from "./academicYear";
import { xbkDataApi } from "@services";
import { showMessage } from "@/lib/toast";

const { authBoundary } = vi.hoisted(() => ({
  authBoundary: { isAdmin: false },
}));

vi.mock("@services", () => ({
  xbkPublicConfigApi: { get: vi.fn(async () => ({ enabled: true })) },
  xbkDataApi: {
    getMeta: vi.fn(),
    getSummary: vi.fn(),
    listCourseResults: vi.fn(),
    exportCurrentTable: vi.fn(),
  },
}));
vi.mock("@hooks/useAuth", () => ({
  default: () => ({ isAdmin: () => authBoundary.isAdmin }),
}));
vi.mock("@/lib/toast", () => ({
  showMessage: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("./components/XbkImportModal", () => ({
  XbkImportModal: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess: (applied: { year?: string; term?: string }) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="单项导入">
        <button
          type="button"
          onClick={() =>
            void onSuccess({ year: "2099-2100", term: "暑期课程" })
          }
        >
          完成单项导入
        </button>
      </div>
    ) : null,
}));
vi.mock("./components/XbkCourseSelectionWorkbookModal", () => ({
  XbkCourseSelectionWorkbookModal: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess: () => void | Promise<void>;
  }) =>
    open ? (
      <div role="dialog" aria-label="学生选课表导入">
        <button type="button" onClick={() => void onSuccess()}>
          完成学生选课表导入
        </button>
      </div>
    ) : null,
}));
vi.mock("./components/XbkExportModal", () => ({ XbkExportModal: () => null }));
vi.mock("./components/XbkDeleteModal", () => ({ XbkDeleteModal: () => null }));
vi.mock("./components/XbkAnalysisModal", () => ({
  XbkAnalysisModal: () => null,
}));
vi.mock("./components/XbkEditModal", () => ({ XbkEditModal: () => null }));

const zeroSummary = {
  students: 0,
  courses: 0,
  selections: 0,
  no_selection_students: 0,
  unselected_count: 0,
  suspended_count: 0,
};
const serverError = {
  response: { status: 500, data: { detail: "Internal Server Error" } },
};
const renderPage = () =>
  render(
    <MemoryRouter>
      <XbkPage />
    </MemoryRouter>,
  );
const kpiValues = () =>
  Array.from(
    document.querySelectorAll(".xbk-kpis .value"),
    (el) => el.textContent,
  );
const failAll = () => {
  vi.mocked(xbkDataApi.getMeta).mockRejectedValue(serverError);
  vi.mocked(xbkDataApi.getSummary).mockRejectedValue(serverError);
  vi.mocked(xbkDataApi.listCourseResults).mockRejectedValue(serverError);
};
const succeedAll = () => {
  vi.mocked(xbkDataApi.getMeta).mockResolvedValue({
    years: ["2026-2027"],
    terms: ["上学期"],
    classes: [],
  });
  vi.mocked(xbkDataApi.getSummary).mockResolvedValue(zeroSummary);
  vi.mocked(xbkDataApi.listCourseResults).mockResolvedValue({
    total: 0,
    items: [],
  });
};
beforeEach(() => {
  authBoundary.isAdmin = false;
  vi.clearAllMocks();
  succeedAll();
});
afterEach(cleanup);

describe("XBK page load failures", () => {
  it("keeps the selected class and request parameters after metadata fails on refresh and retry", async () => {
    const user = userEvent.setup();
    vi.mocked(xbkDataApi.getMeta).mockResolvedValue({
      years: ["2026-2027"],
      terms: ["上学期"],
      classes: ["1班"],
    });
    renderPage();
    await screen.findByText("暂无数据");
    await user.click(screen.getByRole("combobox", { name: "班级" }));
    await user.click(await screen.findByRole("option", { name: /^1班$/ }));
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ class_name: "1班" }),
      ),
    );
    const originalParams = vi
      .mocked(xbkDataApi.listCourseResults)
      .mock.calls.at(-1)![0];
    const originalSummaryParams = vi
      .mocked(xbkDataApi.getSummary)
      .mock.calls.at(-1)![0];
    const listCallCount = vi.mocked(xbkDataApi.listCourseResults).mock.calls
      .length;
    const summaryCallCount = vi.mocked(xbkDataApi.getSummary).mock.calls.length;
    failAll();
    await user.click(screen.getByRole("button", { name: /^刷新$/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("筛选选项加载失败"),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "重试加载" })).toBeEnabled(),
    );
    expect(screen.getByRole("combobox", { name: "班级" })).toHaveTextContent(
      "1班",
    );
    await user.click(screen.getByRole("button", { name: "重试加载" }));
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenCalledTimes(
        listCallCount + 2,
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "重试加载" })).toBeEnabled(),
    );
    expect(screen.getByRole("combobox", { name: "班级" })).toHaveTextContent(
      "1班",
    );
    expect(
      vi
        .mocked(xbkDataApi.listCourseResults)
        .mock.calls.slice(listCallCount)
        .map(([params]) => params),
    ).toEqual([originalParams, originalParams]);
    expect(
      vi
        .mocked(xbkDataApi.getSummary)
        .mock.calls.slice(summaryCallCount)
        .map(([params]) => params),
    ).toEqual([originalSummaryParams, originalSummaryParams]);
    expect(showMessage.success).not.toHaveBeenCalled();
  });

  it("still clears an invalid selected class when successful metadata no longer includes it", async () => {
    const user = userEvent.setup();
    vi.mocked(xbkDataApi.getMeta).mockResolvedValue({
      years: ["2026-2027"],
      terms: ["上学期"],
      classes: ["1班"],
    });
    renderPage();
    await screen.findByText("暂无数据");
    await user.click(screen.getByRole("combobox", { name: "班级" }));
    await user.click(await screen.findByRole("option", { name: /^1班$/ }));
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ class_name: "1班" }),
      ),
    );
    vi.mocked(xbkDataApi.getMeta).mockResolvedValue({
      years: ["2026-2027"],
      terms: ["上学期"],
      classes: [],
    });
    await user.click(screen.getByRole("button", { name: /^刷新$/ }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "班级" })).toHaveTextContent(
        "全部班级",
      ),
    );
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ class_name: undefined }),
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("three 500s persist without zero KPIs or empty results; retry keeps parameters and never reports success", async () => {
    failAll();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("选课总表加载失败"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "筛选选项加载失败；统计数据加载失败",
    );
    expect(kpiValues()).toEqual(Array(5).fill("—"));
    expect(screen.queryByText("暂无数据")).not.toBeInTheDocument();
    expect(
      document.querySelector(".xbk-table-pagination"),
    ).not.toBeInTheDocument();
    const originalParams = vi.mocked(xbkDataApi.listCourseResults).mock
      .calls[0][0];
    expect(originalParams).toMatchObject({
      year: expect.stringMatching(/^\d{4}-\d{4}$/),
      term: "上学期",
      page: 1,
      size: 50,
    });
    fireEvent.click(screen.getByRole("button", { name: "重试加载" }));
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "重试加载" })).toBeEnabled(),
    );
    expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
      originalParams,
    );
    expect(xbkDataApi.getMeta).toHaveBeenLastCalledWith({
      year: originalParams.year,
      term: originalParams.term,
      grade: undefined,
    });
    expect(xbkDataApi.getSummary).toHaveBeenLastCalledWith({
      year: originalParams.year,
      term: originalParams.term,
      grade: undefined,
      class_name: undefined,
    });
    expect(showMessage.success).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "加载失败不代表没有数据",
    );
  });

  it("successful retry clears errors and permits true zero/empty data and pagination", async () => {
    failAll();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("选课总表加载失败"),
    );
    succeedAll();
    fireEvent.click(screen.getByRole("button", { name: "重试加载" }));
    await screen.findByText("暂无数据");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(kpiValues()).toEqual(Array(5).fill("0"));
    expect(document.querySelector(".xbk-table-pagination")).toBeInTheDocument();
    expect(showMessage.success).toHaveBeenCalledWith("已刷新");
  });

  it("an independent summary failure does not hide a successfully empty table", async () => {
    vi.mocked(xbkDataApi.getSummary).mockRejectedValue(serverError);
    renderPage();
    await screen.findByText("暂无数据");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "统计数据加载失败",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("选课总表加载失败");
    expect(kpiValues()).toEqual(Array(5).fill("—"));
  });

  it("a later list failure hides old rows but preserves successful summary counts", async () => {
    vi.mocked(xbkDataApi.getSummary).mockResolvedValue({
      ...zeroSummary,
      students: 12,
      courses: 3,
    });
    vi.mocked(xbkDataApi.listCourseResults).mockResolvedValue({
      total: 1,
      items: [
        {
          id: 1,
          year: "2026-2027",
          term: "上学期",
          student_no: "00001",
          student_name: "回归学生",
          course_code: "C01",
          course_name: "回归课程",
        },
      ],
    });
    renderPage();
    await screen.findByText("回归学生");
    vi.mocked(xbkDataApi.listCourseResults).mockRejectedValue(serverError);
    fireEvent.click(screen.getByRole("button", { name: /^刷新$/ }));
    await screen.findByText("列表加载失败，暂不显示数据。");
    expect(screen.queryByText("回归学生")).not.toBeInTheDocument();
    expect(screen.queryByText("暂无数据")).not.toBeInTheDocument();
    expect(kpiValues().slice(0, 2)).toEqual(["12", "3"]);
    expect(showMessage.success).not.toHaveBeenCalled();
  });

  it("an older summary failure cannot overwrite a newer successful retry", async () => {
    let rejectOld!: (reason: unknown) => void;
    vi.mocked(xbkDataApi.getSummary).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectOld = reject;
        }),
    );
    renderPage();
    await screen.findByText("暂无数据");
    expect(kpiValues()).toEqual(Array(5).fill("—"));
    fireEvent.click(screen.getByRole("button", { name: /^刷新$/ }));
    await waitFor(() =>
      expect(showMessage.success).toHaveBeenCalledWith("已刷新"),
    );
    await act(async () => rejectOld(serverError));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(kpiValues()).toEqual(Array(5).fill("0"));
  });
});

describe("XBK filtered table export", () => {
  it("explicitly exports all filtered results, independent of the visible pagination", async () => {
    // 导出走后端 require_admin，非管理员不再显示入口，用例以管理员身份运行
    authBoundary.isAdmin = true;
    const user = userEvent.setup();
    const rows = Array.from({ length: 52 }, (_, index) => ({
      id: index + 1,
      year: "2026-2027",
      term: "上学期",
      student_no: `AUDIT-${String(index + 1).padStart(3, "0")}`,
      student_name: `验收学生${index + 1}`,
      course_code: "C01",
      course_name: "验收课程",
    }));
    vi.mocked(xbkDataApi.listCourseResults).mockImplementation(
      async ({ page = 1, size = 50 }) => ({
        total: rows.length,
        items: rows.slice((page - 1) * size, page * size),
      }),
    );
    vi.mocked(xbkDataApi.exportCurrentTable).mockResolvedValue(
      new Blob(["workbook"]),
    );
    const createUrl = vi.fn(() => "blob:xbk-filtered-export");
    const revokeUrl = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(class extends URL {}, {
        createObjectURL: createUrl,
        revokeObjectURL: revokeUrl,
      }),
    );
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    try {
      renderPage();
      await screen.findByText("验收学生1");
      const exportButton = screen.getByRole("button", {
        name: /^导出当前结果$/,
      });
      expect(exportButton).toHaveAttribute(
        "title",
        "导出当前表格中符合筛选条件的全部结果（不限当前分页）",
      );
      expect(
        screen.queryByRole("button", { name: /^当前页$/ }),
      ).not.toBeInTheDocument();
      await user.click(exportButton);
      await waitFor(() =>
        expect(xbkDataApi.exportCurrentTable).toHaveBeenCalledTimes(1),
      );
      await user.click(screen.getByRole("button", { name: /^下一页$/ }));
      await screen.findByText("验收学生52");
      expect(screen.queryByText("验收学生1")).not.toBeInTheDocument();
      await user.click(exportButton);
      await waitFor(() =>
        expect(xbkDataApi.exportCurrentTable).toHaveBeenCalledTimes(2),
      );
      const params = vi
        .mocked(xbkDataApi.exportCurrentTable)
        .mock.calls.map(([value]) => value);
      expect(params[0]).toEqual(params[1]);
      expect(params[0]).toMatchObject({
        scope: "course_results",
        format: "xlsx",
      });
      expect(params[0]).not.toHaveProperty("page");
      expect(params[0]).not.toHaveProperty("size");
      expect(showMessage.success).toHaveBeenLastCalledWith(
        "已导出当前筛选的全部结果",
      );
      expect(anchorClick).toHaveBeenCalledTimes(2);
      expect(revokeUrl).toHaveBeenCalledTimes(2);
    } finally {
      anchorClick.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe("XBK dynamic term filters", () => {
  it("keeps globally available years discoverable when the default year has no data", async () => {
    const user = userEvent.setup();
    vi.mocked(xbkDataApi.getMeta).mockImplementation(async (params = {}) => {
      if (!params.year) {
        return { years: ["2098-2099"], terms: ["暑期课程"], classes: [] };
      }
      if (params.year === "2098-2099") {
        return { years: ["2098-2099"], terms: ["暑期课程"], classes: [] };
      }
      return { years: [], terms: [], classes: [] };
    });

    renderPage();
    await screen.findByText("暂无数据");
    const currentAcademicYear = getCurrentAcademicYear();
    const yearInput = screen.getByRole("textbox", { name: "学年" });
    expect(yearInput).toHaveValue(currentAcademicYear);

    // 已有学年通过下拉选择，同时允许直接输入新学年
    await user.click(screen.getByRole("button", { name: "选择已有学年" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "2098-2099" }),
    );

    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ year: "2098-2099" }),
      ),
    );
    expect(yearInput).toHaveValue("2098-2099");
    await user.click(screen.getByRole("combobox", { name: "学期" }));
    expect(
      await screen.findByRole("option", { name: "暑期课程" }),
    ).toBeInTheDocument();
  });

  it("accepts a manually typed academic year that is not in the dropdown", async () => {
    const user = userEvent.setup();
    vi.mocked(xbkDataApi.getMeta).mockResolvedValue({
      years: ["2098-2099"],
      terms: [],
      classes: [],
    });

    renderPage();
    await screen.findByText("暂无数据");
    const yearInput = screen.getByRole("textbox", { name: "学年" });
    await user.clear(yearInput);
    await user.type(yearInput, "2030-2031");

    expect(yearInput).toHaveValue("2030-2031");
    expect(screen.queryByText("格式：YYYY-YYYY")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ year: "2030-2031" }),
      ),
    );
  });

  it("normalizes a bare 4-digit year on blur like the backend does", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("暂无数据");
    const yearInput = screen.getByRole("textbox", { name: "学年" });
    await user.clear(yearInput);
    await user.type(yearInput, "2030");
    // 未失焦前不提交，避免中间态触发请求
    expect(yearInput).toHaveValue("2030");
    await user.tab();
    expect(yearInput).toHaveValue("2030-2031");
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ year: "2030-2031" }),
      ),
    );
  });

  it("warns when the typed academic year is malformed", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("暂无数据");
    const yearInput = screen.getByRole("textbox", { name: "学年" });
    // 清空输入框只改本地草稿，失焦时才提交“全部学年”；等清空触发的请求稳定后再取基线，
    // 避免与后续输入产生的调用交错导致计数不稳定。
    await user.clear(yearInput);
    await waitFor(() =>
      expect(vi.mocked(xbkDataApi.listCourseResults).mock.calls.length).toBeGreaterThan(0),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    const listCalls = vi.mocked(xbkDataApi.listCourseResults).mock.calls.length;
    const summaryCalls = vi.mocked(xbkDataApi.getSummary).mock.calls.length;

    // 逐字符输入非法中间值：只在输入框下方提示，不触发任何请求
    await user.type(yearInput, "2027");
    // 纯 4 位年份是后端支持的合法写法，输入过程中不会出现错误提示
    expect(screen.queryByText("格式：YYYY-YYYY")).not.toBeInTheDocument();
    expect(
      vi.mocked(xbkDataApi.listCourseResults).mock.calls.length,
    ).toBe(listCalls);
    expect(vi.mocked(xbkDataApi.getSummary).mock.calls.length).toBe(
      summaryCalls,
    );

    // 真正非法的输入才显示格式提示
    await user.type(yearInput, "-2029");
    expect(await screen.findByText("格式：YYYY-YYYY")).toBeInTheDocument();
    // 非法值不写入 filters，因此不会触发新请求
    expect(
      vi.mocked(xbkDataApi.listCourseResults).mock.calls.length,
    ).toBe(listCalls);
  });

  it("keeps a custom metadata term selectable and passes it to filtered export", async () => {
    // 导出按钮只对管理员显示（后端 require_admin），本用例以管理员身份验证导出参数
    authBoundary.isAdmin = true;
    const user = userEvent.setup();
    vi.mocked(xbkDataApi.getMeta).mockImplementation(async ({ term } = {}) => ({
      years: ["2026-2027"],
      terms: term === "暑期课程" ? ["下学期"] : ["暑期课程"],
      classes: [],
    }));
    vi.mocked(xbkDataApi.exportCurrentTable).mockResolvedValue(
      new Blob(["workbook"]),
    );
    const createUrl = vi.fn(() => "blob:xbk-custom-term-export");
    const revokeUrl = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(class extends URL {}, {
        createObjectURL: createUrl,
        revokeObjectURL: revokeUrl,
      }),
    );
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      renderPage();
      await screen.findByText("暂无数据");
      await user.click(screen.getByRole("combobox", { name: "学期" }));
      await user.click(await screen.findByRole("option", { name: "暑期课程" }));

      await waitFor(() =>
        expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
          expect.objectContaining({ term: "暑期课程" }),
        ),
      );
      expect(screen.getByRole("combobox", { name: "学期" })).toHaveTextContent(
        "暑期课程",
      );

      await user.click(screen.getByRole("combobox", { name: "学期" }));
      expect(
        await screen.findByRole("option", { name: "暑期课程" }),
      ).toBeInTheDocument();
      await user.keyboard("{Escape}");

      await user.click(screen.getByRole("button", { name: /^导出当前结果$/ }));
      await waitFor(() =>
        expect(xbkDataApi.exportCurrentTable).toHaveBeenLastCalledWith(
          expect.objectContaining({ term: "暑期课程" }),
        ),
      );
    } finally {
      anchorClick.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe("XBK course-selection workbook import", () => {
  it("keeps four import entries and opens the dedicated workbook modal for admins", async () => {
    authBoundary.isAdmin = true;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("暂无数据");

    for (const name of [
      "导入选课表",
      "导入学生",
      "导入课程",
      "导入选课",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "导入选课表" }));

    expect(
      screen.getByRole("dialog", { name: "学生选课表导入" }),
    ).toBeInTheDocument();
  });

  it("writes the modal's actual year/term back to the filter bar after import", async () => {
    authBoundary.isAdmin = true;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("暂无数据");

    await user.click(screen.getByRole("button", { name: "导入学生" }));
    await user.click(screen.getByRole("button", { name: "完成单项导入" }));

    // 导入成功后筛选栏跟随弹窗实际使用的学年/学期，并据此重新请求
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "学年" })).toHaveValue(
        "2099-2100",
      ),
    );
    expect(screen.getByRole("combobox", { name: "学期" })).toHaveTextContent(
      "暑期课程",
    );
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ year: "2099-2100", term: "暑期课程" }),
      ),
    );
  });
});

describe("XBK permissions and paging guards", () => {
  it("hides export actions from non-admins because the API requires admin", async () => {
    renderPage();
    await screen.findByText("暂无数据");
    expect(
      screen.queryByRole("button", { name: /^导出当前结果$/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^导出$/ })).not.toBeInTheDocument();
    // 分析属于只读接口，仍然可用
    expect(screen.getByRole("button", { name: /^分析$/ })).toBeInTheDocument();
  });

  it("hides the search box on tabs that cannot filter by keyword and clears it on switch", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("暂无数据");
    const search = screen.getByRole("textbox", { name: "搜索" });
    await user.type(search, "张三");
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ search_text: "张三" }),
      ),
    );

    await user.click(screen.getByRole("tab", { name: "未选课" }));
    // 该页签不支持搜索：隐藏搜索框并提示，同时清空关键字
    expect(
      screen.queryByRole("textbox", { name: "搜索" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("当前页签不支持搜索，切换回列表页签后可用"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "选课总表" }));
    expect(screen.getByRole("textbox", { name: "搜索" })).toHaveValue("");
  });

  it("clamps the page back to the last page when the total shrinks", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 52 }, (_, index) => ({
      id: index + 1,
      year: "2026-2027",
      term: "上学期",
      student_no: `P-${index + 1}`,
      student_name: `分页学生${index + 1}`,
      course_code: "C01",
    }));
    vi.mocked(xbkDataApi.listCourseResults).mockImplementation(
      async ({ page = 1, size = 50 }) => ({
        total: rows.length,
        items: rows.slice((page - 1) * size, page * size),
      }),
    );
    renderPage();
    await screen.findByText("分页学生1");
    await user.click(screen.getByRole("button", { name: /^下一页$/ }));
    await screen.findByText("分页学生52");
    expect(screen.getByText("2/2")).toBeInTheDocument();

    // 数据变少后自动回退到最后一页，而不是停在空的第 2 页
    vi.mocked(xbkDataApi.listCourseResults).mockResolvedValue({
      total: 3,
      items: rows.slice(0, 3),
    });
    await user.click(screen.getByRole("button", { name: /^刷新$/ }));
    await waitFor(() => expect(screen.getByText("1/1")).toBeInTheDocument());
    expect(screen.getByText("分页学生1")).toBeInTheDocument();
  });
});

describe("XBK grade options", () => {
  it("offers 高三 in the filter bar and filters by it", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("暂无数据");
    await user.click(screen.getByRole("combobox", { name: "年级" }));
    expect(
      await screen.findByRole("option", { name: "高一" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "高二" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "高三" }));
    await waitFor(() =>
      expect(xbkDataApi.listCourseResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ grade: "高三" }),
      ),
    );
    expect(screen.getByRole("combobox", { name: "年级" })).toHaveTextContent(
      "高三",
    );
  });
});
