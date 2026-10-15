import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CategoryManageModal from "@/pages/Admin/Articles/CategoryManageModal";
import { categoryApi } from "@services";
import type { CategoryWithUsage } from "@services";
import { showMessage } from "@/lib/toast";

// Keep the real modal, form, table and Radix focus scopes; isolate HTTP and mutations.
vi.mock("@services", () => ({ categoryApi: {
  listCategories: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn(),
} }));
const { batchDelete } = vi.hoisted(() => ({ batchDelete: vi.fn() }));
vi.mock("@hooks/queries/useCategoriesQuery", () => ({
  useBatchDeleteCategories: () => ({ mutateAsync: batchDelete }),
}));
vi.mock("@services/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/toast", () => ({ showMessage: {
  error: vi.fn(), success: vi.fn(), warning: vi.fn(),
} }));

const records: CategoryWithUsage[] = [
  { id: 17, name: "Alpha 分类", slug: "alpha", description: "第一组", article_count: 2,
    created_at: "2026-10-12T00:00:00Z", updated_at: "2026-10-12T00:00:00Z" },
  { id: 18, name: "Beta 分类", slug: "beta", description: "第二组", article_count: 7,
    created_at: "2026-10-13T00:00:00Z", updated_at: "2026-10-13T00:00:00Z" },
];
const response = (categories = records): Awaited<ReturnType<typeof categoryApi.listCategories>> => ({
  data: { categories, total: categories.length, page: 1, size: 20, total_pages: 1 },
} as Awaited<ReturnType<typeof categoryApi.listCategories>>);

function mountModal() {
  const onCategoryChange = vi.fn();
  return { ...render(<CategoryManageModal visible onClose={vi.fn()} onCategoryChange={onCategoryChange} />), onCategoryChange };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(categoryApi.listCategories).mockResolvedValue(response());
  vi.mocked(categoryApi.createCategory).mockResolvedValue({} as never);
  vi.mocked(categoryApi.updateCategory).mockResolvedValue({} as never);
  vi.mocked(categoryApi.deleteCategory).mockResolvedValue({} as never);
  batchDelete.mockResolvedValue({ successCount: 1, errorCount: 0 });
});
afterEach(cleanup);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("article category request generation isolation", () => {
  async function overlapSearch() {
    const older = deferred<ReturnType<typeof response>>();
    const newer = deferred<ReturnType<typeof response>>();
    vi.mocked(categoryApi.listCategories).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    mountModal();
    fireEvent.change(screen.getByRole("textbox", { name: "搜索分类名称或 slug" }), { target: { value: "Beta" } });
    await waitFor(() => expect(categoryApi.listCategories).toHaveBeenCalledTimes(2));
    return { older, newer };
  }

  it("ignores an old success arriving after the latest filtered success", async () => {
    const { older, newer } = await overlapSearch();
    await act(async () => newer.resolve(response()));
    expect(await screen.findByText(records[1].name)).toBeVisible();
    expect(screen.queryByText(records[0].name)).not.toBeInTheDocument();
    await act(async () => older.resolve(response()));
    expect(screen.queryByText(records[0].name)).not.toBeInTheDocument();
    expect(screen.getByText(records[1].name)).toBeVisible();
  });

  it("ignores an old rejection after the latest filtered success, including its toast", async () => {
    const { older, newer } = await overlapSearch();
    await act(async () => newer.resolve(response()));
    await screen.findByText(records[1].name);
    await act(async () => older.reject({ response: { status: 503 } }));
    expect(showMessage.error).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(records[1].name)).toBeVisible();
  });

  it("keeps the newest request loading when an older request finishes first", async () => {
    const { older, newer } = await overlapSearch();
    await act(async () => older.resolve(response()));
    try {
      expect(screen.getByText("正在加载分类...")).toBeVisible();
      expect(screen.getByRole("button", { name: "刷新" })).toBeDisabled();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    } finally {
      await act(async () => newer.resolve(response()));
    }
    expect(await screen.findByText(records[1].name)).toBeVisible();
    expect(screen.getByRole("button", { name: "刷新" })).toBeEnabled();
  });

  it("preserves the newest failure when an older success arrives later", async () => {
    const { older, newer } = await overlapSearch();
    await act(async () => newer.reject({ response: { status: 503 } }));
    expect(await screen.findByRole("alert")).toHaveTextContent("加载分类列表失败");
    await act(async () => older.resolve(response()));
    expect(screen.getByRole("alert")).toHaveTextContent("加载分类列表失败");
    expect(screen.queryByText(records[0].name)).not.toBeInTheDocument();
    expect(showMessage.error).toHaveBeenCalledTimes(1);
  });

  it("invalidates a hidden dialog's read while a reopened dialog is still loading", async () => {
    const older = deferred<ReturnType<typeof response>>();
    const newer = deferred<ReturnType<typeof response>>();
    vi.mocked(categoryApi.listCategories).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const props = { onClose: vi.fn() };
    const { rerender } = render(<CategoryManageModal visible {...props} />);
    rerender(<CategoryManageModal visible={false} {...props} />);
    rerender(<CategoryManageModal visible {...props} />);
    await waitFor(() => expect(categoryApi.listCategories).toHaveBeenCalledTimes(2));
    await act(async () => older.reject({ response: { status: 503 } }));
    try {
      expect(showMessage.error).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("正在加载分类...")).toBeVisible();
    } finally {
      await act(async () => newer.resolve(response()));
    }
    expect(await screen.findByText(records[0].name)).toBeVisible();
  });

  it("ignores a pending read's rejection after unmount", async () => {
    const pending = deferred<ReturnType<typeof response>>();
    vi.mocked(categoryApi.listCategories).mockReturnValueOnce(pending.promise);
    const { unmount } = mountModal();
    unmount();
    await act(async () => pending.reject({ response: { status: 503 } }));
    expect(showMessage.error).not.toHaveBeenCalled();
  });
});

describe("article category management error and empty states", () => {
  it("shows an initial 503 as an error with explicit retry, then recovers", async () => {
    vi.mocked(categoryApi.listCategories).mockRejectedValueOnce({ response: { status: 503 } });
    mountModal();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("加载分类列表失败");
    expect(screen.queryByText("暂无分类数据")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "添加第一个分类" })).not.toBeInTheDocument();
    expect(showMessage.error).toHaveBeenCalledWith("加载分类列表失败");
    await userEvent.setup().click(within(alert).getByRole("button", { name: "重试" }));
    expect(await screen.findByText(records[0].name)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(categoryApi.listCategories).toHaveBeenCalledTimes(2);
    expect(categoryApi.listCategories).toHaveBeenLastCalledWith({ page: 1, size: 20, include_usage_count: true });
  });

  it("retains the last successful rows and reports a refresh error until retry succeeds", async () => {
    mountModal();
    await screen.findByText(records[0].name);
    vi.mocked(categoryApi.listCategories).mockRejectedValueOnce(new Error("503"));
    await userEvent.setup().click(screen.getByRole("button", { name: "刷新" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("上次加载的数据");
    expect(screen.getByText(records[0].name)).toBeVisible();
    expect(screen.getByText(records[1].name)).toBeVisible();
    await userEvent.setup().click(within(alert).getByRole("button", { name: "重试" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(await screen.findByText(records[0].name)).toBeVisible();
  });

  it("distinguishes no local matches from an empty source without changing request params", async () => {
    mountModal();
    await screen.findByText(records[0].name);
    const search = screen.getByPlaceholderText("搜索分类名称或 slug...");
    fireEvent.change(search, { target: { value: "missing-local-category" } });
    expect(await screen.findByText("暂无符合条件的分类")).toBeVisible();
    expect(screen.queryByText("暂无分类数据")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "添加第一个分类" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(categoryApi.listCategories).toHaveBeenLastCalledWith({ page: 1, size: 20, include_usage_count: true });
    fireEvent.change(search, { target: { value: " ALPHA " } });
    expect(await screen.findByText(records[0].name)).toBeVisible();
    expect(screen.queryByText(records[1].name)).not.toBeInTheDocument();
  });

  it("offers first creation only after a successful empty response", async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue(response([]));
    mountModal();
    expect(await screen.findByText("暂无分类数据")).toBeVisible();
    expect(screen.getByRole("button", { name: "添加第一个分类" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("article category nested dialog focus", () => {
  it.each(["取消", "Escape"])("returns focus to New after %s without pointer focus", async (close) => {
    mountModal();
    await screen.findByText(records[0].name);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "新增分类" });
    screen.getByPlaceholderText("搜索分类名称或 slug...").focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "添加新分类" });
    if (close === "Escape") await user.keyboard("{Escape}");
    else await user.click(within(dialog).getByRole("button", { name: close }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "添加新分类" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "分类管理" })).toBeVisible();
  });

  it("returns focus to the exact row Edit button after Escape", async () => {
    mountModal();
    const row = (await screen.findByText(records[0].name)).closest("tr")!;
    const trigger = within(row).getByRole("button", { name: "编辑" });
    screen.getByPlaceholderText("搜索分类名称或 slug...").focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "编辑分类" });
    expect(within(dialog).getByRole("textbox", { name: "分类名称" })).toHaveValue(records[0].name);
    await userEvent.setup().keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑分类" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("article category controls and existing operations", () => {
  it("keeps semantic names, weak control boundaries and mobile wrapping structure", async () => {
    mountModal();
    await screen.findByText(records[0].name);
    const user = userEvent.setup();
    const search = screen.getByRole("textbox", { name: "搜索分类名称或 slug" });
    expect(search).toHaveClass("border-transparent", "bg-transparent", "focus-visible:ring-inset");
    expect(search.parentElement).toHaveClass("min-w-0", "w-full");
    const toggle = screen.getByRole("button", { name: "筛选" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const filters = screen.getByRole("region", { name: "高级筛选" });
    const sort = within(filters).getByRole("combobox", { name: "排序方式" });
    expect(sort).toHaveClass("border-transparent", "bg-transparent", "focus-visible:ring-inset");
    const minimum = within(filters).getByRole("spinbutton", { name: "最少文章数" });
    expect(minimum).toHaveClass("border-transparent", "bg-transparent");
    minimum.focus();
    expect(minimum).toHaveFocus();
    await user.click(within(filters).getByRole("button", { name: "收起" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("preserves local article-count sorting, minimum filtering and reset", async () => {
    mountModal();
    await screen.findByText(records[0].name);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("combobox", { name: "排序方式" }));
    await user.click(screen.getByRole("option", { name: "文章数量降序" }));
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")[1]).toHaveTextContent(records[1].name));
    fireEvent.change(screen.getByRole("spinbutton", { name: "最少文章数" }), { target: { value: "5" } });
    await waitFor(() => expect(screen.queryByText(records[0].name)).not.toBeInTheDocument());
    expect(await screen.findByText(records[1].name)).toBeVisible();
    expect(categoryApi.listCategories).toHaveBeenLastCalledWith({ page: 1, size: 20, include_usage_count: true });
    await user.click(screen.getByRole("button", { name: "重置" }));
    expect(await screen.findByText(records[0].name)).toBeVisible();
    expect(screen.getByText(records[1].name)).toBeVisible();
  });

  it("retains full long names, slugs and descriptions within fixed table columns", async () => {
    const long = { ...records[0], name: "LongCategory".repeat(8), slug: "long-category".repeat(7), description: "LongDescription".repeat(12) };
    vi.mocked(categoryApi.listCategories).mockResolvedValue(response([long]));
    mountModal();
    const name = await screen.findByText(long.name);
    const slug = screen.getByText(long.slug);
    expect(name).toHaveAttribute("title", long.name);
    expect(slug).toHaveAttribute("title", long.slug);
    expect(name.parentElement).toHaveClass("whitespace-normal", "[overflow-wrap:anywhere]");
    expect(screen.getByText(long.description)).toHaveClass("[overflow-wrap:anywhere]");
    expect(screen.getByRole("table")).toHaveClass("table-fixed", "min-w-[980px]");
  });

  it("keeps validation and create payload, notifies the consumer and restores focus after save", async () => {
    const { onCategoryChange } = mountModal();
    await screen.findByText(records[0].name);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "新增分类" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "添加新分类" });
    await user.click(within(dialog).getByRole("button", { name: "创建分类" }));
    expect(await within(dialog).findByText("请输入分类名称")).toBeVisible();
    expect(categoryApi.createCategory).not.toHaveBeenCalled();
    await user.type(within(dialog).getByRole("textbox", { name: "分类名称" }), " New Category ");
    await user.click(within(dialog).getByRole("button", { name: "从名称生成" }));
    const slug = within(dialog).getByRole("textbox", { name: "URL 标识 (slug)" });
    await user.clear(slug);
    await user.type(slug, "new-category");
    await user.click(within(dialog).getByRole("button", { name: "创建分类" }));
    await waitFor(() => expect(categoryApi.createCategory).toHaveBeenCalledWith({ name: "New Category", slug: "new-category", description: null }));
    await waitFor(() => expect(onCategoryChange).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "添加新分类" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps a failed update open with its values and existing error message", async () => {
    vi.mocked(categoryApi.updateCategory).mockRejectedValueOnce({ response: { data: { detail: "分类名称冲突" } } });
    const { onCategoryChange } = mountModal();
    const row = (await screen.findByText(records[0].name)).closest("tr")!;
    const user = userEvent.setup();
    await user.click(within(row).getByRole("button", { name: "编辑" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑分类" });
    await user.click(within(dialog).getByRole("button", { name: "保存修改" }));
    await waitFor(() => expect(showMessage.error).toHaveBeenCalledWith("分类名称冲突"));
    expect(within(dialog).getByRole("textbox", { name: "分类名称" })).toHaveValue(records[0].name);
    expect(onCategoryChange).not.toHaveBeenCalled();
    expect(categoryApi.updateCategory).toHaveBeenCalledWith(records[0].id, { name: records[0].name, slug: records[0].slug, description: records[0].description });
  });

  it("keeps single-delete confirmation and exact selected ids for batch deletion", async () => {
    const { onCategoryChange } = mountModal();
    const row = (await screen.findByText(records[0].name)).closest("tr")!;
    const user = userEvent.setup();
    await user.click(within(row).getByRole("button", { name: "删除" }));
    expect(categoryApi.deleteCategory).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "确认" }));
    await waitFor(() => expect(categoryApi.deleteCategory).toHaveBeenCalledWith(records[0].id));
    await waitFor(() => expect(onCategoryChange).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await user.click(await screen.findByRole("checkbox", { name: `选择分类 ${records[1].name}` }));
    await user.click(screen.getByRole("button", { name: "批量删除" }));
    expect(batchDelete).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "确认" }));
    await waitFor(() => expect(batchDelete).toHaveBeenCalledWith([records[1].id]));
    await waitFor(() => expect(onCategoryChange).toHaveBeenCalledTimes(2));
  });
});
