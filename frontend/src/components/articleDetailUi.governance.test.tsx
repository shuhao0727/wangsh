import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleWithRelations } from "@services";
import "@/utils/dayjs";
import ArticleDetailPage from "@/pages/Articles/Detail";

const mocks = vi.hoisted(() => ({
  getPublicArticleBySlug: vi.fn(),
  getArticle: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@services", () => ({ articleApi: { getPublicArticleBySlug: mocks.getPublicArticleBySlug, getArticle: mocks.getArticle } }));
vi.mock("@services/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/toast", () => ({ showMessage: { success: mocks.success, error: mocks.error } }));
vi.mock("@utils/articleUpdatedEvent", () => ({ subscribeArticleUpdated: () => () => undefined }));

const longText = "UnbrokenMetadata".repeat(16);
const article: ArticleWithRelations = {
  id: 13, slug: "governance-article", title: "文章标题" + longText,
  summary: "摘要" + longText, content: "# 示例\n\n```python\n# 这不是目录\nprint('long code')\n```\n\n## 下一节\n\n说明。",
  published: true, author_id: 7, category_id: 3,
  author: { id: 7, username: "author", full_name: "作者" + longText },
  category: { id: 3, name: "分类" + longText, slug: "category" },
  created_at: "2026-10-12T09:00:00Z", updated_at: "2026-10-12T09:00:00Z",
};
function mount() {
  return render(<MemoryRouter initialEntries={["/articles/governance-article"]}>
    <Routes><Route path="/articles/:slug" element={<ArticleDetailPage />} />
      <Route path="/articles" element={<p>文章列表目的地</p>} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); mocks.getPublicArticleBySlug.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("article detail governance", () => {
  it("retains full long title, summary, author, linked category and semantic dates through the public getter", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue({ data: article });
    mount();
    expect(await screen.findByRole("heading", { level: 1, name: article.title })).toBeVisible();
    expect(screen.getByText(article.summary)).toBeVisible();
    expect(screen.getByText(article.author.full_name!)).toHaveAttribute("title", article.author.full_name!);
    expect(screen.getByRole("link", { name: article.category!.name })).toHaveAttribute("href", "/articles?category=3");
    expect(screen.getByText("2026年10月12日").closest("time")).toHaveAttribute("datetime", article.created_at);
    expect(mocks.getPublicArticleBySlug).toHaveBeenCalledWith("governance-article");
    expect(mocks.getArticle).not.toHaveBeenCalled();
  });

  it("retries the same public slug after an error and then shows the article", async () => {
    mocks.getPublicArticleBySlug.mockRejectedValueOnce({ response: { data: { detail: "临时不可用" } } }).mockResolvedValueOnce({ data: article });
    const user = userEvent.setup();
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("临时不可用");
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByRole("heading", { level: 1, name: article.title })).toBeVisible();
    expect(mocks.getPublicArticleBySlug.mock.calls).toEqual([["governance-article"], ["governance-article"]]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("makes loading and its return action accessible while the request is pending", async () => {
    mocks.getPublicArticleBySlug.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    mount();
    expect(screen.getByRole("status", { name: "正在加载文章" })).toHaveAttribute("aria-busy", "true");
    await user.tab();
    expect(screen.getByRole("button", { name: "返回文章列表" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("文章列表目的地")).toBeVisible();
  });

  it("preserves heading navigation, ignores fenced headings and copies complete code", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue({ data: article });
    const user = userEvent.setup();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    mount();
    await screen.findByRole("heading", { name: "下一节" });
    const toc = screen.getAllByRole("navigation", { name: "文章目录" }).at(-1)!;
    // Content commits before the effect that derives the TOC; wait for its own ready state.
    const nextSection = await within(toc).findByRole("button", { name: "下一节" });
    expect(within(toc).queryByText("暂无目录")).not.toBeInTheDocument();
    expect(within(toc).queryByRole("button", { name: "这不是目录" })).not.toBeInTheDocument();
    await user.click(nextSection);
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    const write = vi.spyOn(navigator.clipboard, "writeText");
    await user.click(screen.getByRole("button", { name: "复制" }));
    expect(write).toHaveBeenCalledWith("# 这不是目录\nprint('long code')\n");
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("代码已复制到剪贴板"));
  });

  it("collapses the native mobile directory and restores its summary focus when selecting a heading", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue({ data: article });
    const user = userEvent.setup();
    const { container } = mount();
    await screen.findByRole("heading", { name: "下一节" });
    const disclosure = container.querySelector("details")!;
    const summary = disclosure.querySelector("summary")!;
    await user.click(summary);
    expect(disclosure.open).toBe(true);
    await user.click(await within(disclosure).findByRole("button", { name: "下一节" }));
    expect(disclosure.open).toBe(false);
    expect(summary).toHaveFocus();
  });

  it("ignores a late response after slug navigation and derives the TOC from the current article", async () => {
    let resolvePrevious!: (value: { data: ArticleWithRelations }) => void;
    mocks.getPublicArticleBySlug.mockReturnValueOnce(new Promise<{ data: ArticleWithRelations }>((resolve) => {
      resolvePrevious = resolve;
    }));
    const currentArticle = { ...article, id: 14, slug: "current-article", title: "当前文章", content: "## 当前章节\n\n当前正文。" };
    mocks.getPublicArticleBySlug.mockResolvedValueOnce({ data: currentArticle });
    const router = createMemoryRouter([{ path: "/articles/:slug", element: <ArticleDetailPage /> }], {
      initialEntries: ["/articles/governance-article"],
    });
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("status", { name: "正在加载文章" })).toBeInTheDocument();
    await act(async () => { await router.navigate("/articles/current-article"); });
    expect(await screen.findByRole("heading", { name: "当前文章", level: 1 })).toBeVisible();
    const toc = screen.getAllByRole("navigation", { name: "文章目录" }).at(-1)!;
    expect(await within(toc).findByRole("button", { name: "当前章节" })).toBeVisible();
    await act(async () => { resolvePrevious({ data: article }); });
    expect(screen.queryByRole("heading", { name: article.title })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "当前文章", level: 1 })).toBeVisible();
    expect(within(toc).getByRole("button", { name: "当前章节" })).toBeVisible();
    expect(within(toc).queryByRole("button", { name: "下一节" })).not.toBeInTheDocument();
    expect(mocks.getPublicArticleBySlug.mock.calls).toEqual([["governance-article"], ["current-article"]]);
  });

  it("retains a public denial and allows keyboard return without trying an authenticated API", async () => {
    mocks.getPublicArticleBySlug.mockRejectedValue({ response: { status: 404, data: { detail: "文章不存在或未发布" } } });
    const user = userEvent.setup();
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("文章不存在或未发布");
    expect(screen.queryByText(article.title)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "返回文章列表" })[0]);
    expect(screen.getByText("文章列表目的地")).toBeVisible();
    expect(mocks.getArticle).not.toHaveBeenCalled();
  });

  it("derives directory entries from rendered Markdown, including setext headings and decoded entities", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue({ data: {
      ...article, title: "阅读规则",
      content: "下划线标题\n----------\n\n## A &amp; B\n\n#not-a-heading\n\n## 最后一节",
    } });
    mount();
    await screen.findByRole("heading", { level: 1, name: "阅读规则" });
    const toc = screen.getAllByRole("navigation", { name: "文章目录" }).at(-1)!;
    await within(toc).findByRole("button", { name: "最后一节" });
    expect(within(toc).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "下划线标题", "A & B", "最后一节",
    ]);
  });

  it("does not derive headings from mixed or shorter markers inside a longer code fence", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue({ data: {
      ...article, content: "````text\n~~~\n## 围栏里的伪标题\n```\n## 仍是代码\n````\n\n## 真正章节",
    } });
    mount();
    await screen.findByRole("heading", { name: "真正章节" });
    const toc = screen.getAllByRole("navigation", { name: "文章目录" }).at(-1)!;
    await within(toc).findByRole("button", { name: "真正章节" });
    expect(within(toc).getAllByRole("button").map((button) => button.textContent)).toEqual(["真正章节"]);
  });

  it("keeps article title and repeated body headings as distinct navigation targets", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue({ data: {
      ...article, title: "重复章节", content: "## 重复章节\n\n第一段\n\n## 重复章节\n\n第二段",
    } });
    const user = userEvent.setup();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const { container } = mount();
    const headings = await screen.findAllByRole("heading", { name: "重复章节" });
    const toc = screen.getAllByRole("navigation", { name: "文章目录" }).at(-1)!;
    const entries = await within(toc).findAllByRole("button", { name: "重复章节" });
    expect(headings).toHaveLength(3);
    expect(new Set(headings.map((heading) => heading.id)).size).toBe(3);
    await user.click(entries[0]);
    expect(scroll.mock.contexts.at(-1)).toBe(container.querySelector(".article-content h2"));
    await user.click(entries[1]);
    expect(scroll.mock.contexts.at(-1)).toBe(container.querySelectorAll(".article-content h2")[1]);
  });


  it("avoids generated suffix and article-title ID collisions and gives symbolic headings a target", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue({ data: {
      ...article, content: "## Same\n\n## Same\n\n## Same-2\n\n## article-title-13\n\n## 😀",
    } });
    const { container } = mount();
    const toc = (await screen.findAllByRole("navigation", { name: "文章目录" })).at(-1)!;
    await within(toc).findByRole("button", { name: "😀" });
    const ids = Array.from(container.querySelectorAll("h1, h2"), (heading) => heading.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

});
