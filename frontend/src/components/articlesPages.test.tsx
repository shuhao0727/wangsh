import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, MemoryRouter, RouterProvider, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ArticlesPage from "@/pages/Articles";
import ArticleItem from "@/pages/Articles/components/ArticleItem";
import { articleApi, categoryApi } from "@/services";

const emptyArticleList = {
  total: 0,
  articles: [],
  page: 1,
  size: 12,
  total_pages: 1,
};

function UrlControls() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output aria-label="current URL">{location.search}</output>
    <button onClick={() => navigate("/articles")}>模拟返回无筛选地址</button></>;
}

describe("public Articles page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retains every typed character while URL navigation is pending", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({ data: { categories: [] } } as never);
    vi.spyOn(articleApi, "listPublicArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const searchArticles = vi.spyOn(articleApi, "searchArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const router = createMemoryRouter([{
      path: "/articles",
      loader: () => new Promise((resolve) => setTimeout(() => resolve(null), 40)),
      element: <><ArticlesPage /><UrlControls /></>,
      HydrateFallback: () => null,
    }], { initialEntries: ["/articles?category=7&page=2&size=24"] });
    render(<RouterProvider router={router} />);
    const input = await screen.findByRole("textbox", { name: "搜索文章" });
    const keyword = "independent_ui_no_match_20261012";
    await userEvent.setup().type(input, keyword);
    expect(input).toHaveValue(keyword);
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("q")).toBe(keyword), { timeout: 2500 });
    await waitFor(() => expect(searchArticles).toHaveBeenLastCalledWith(keyword, 1, 24, 7), { timeout: 2500 });
  });

  it("keeps newer keystrokes when an earlier debounced URL commits", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({ data: { categories: [] } } as never);
    vi.spyOn(articleApi, "listPublicArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const searchArticles = vi.spyOn(articleApi, "searchArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const router = createMemoryRouter([{
      path: "/articles",
      loader: () => new Promise((resolve) => setTimeout(() => resolve(null), 80)),
      element: <><ArticlesPage /><UrlControls /></>,
      HydrateFallback: () => null,
    }], { initialEntries: ["/articles"] });
    const user = userEvent.setup();
    render(<RouterProvider router={router} />);
    const input = await screen.findByRole("textbox", { name: "搜索文章" });
    await user.type(input, "independent_");
    await waitFor(() => expect(router.state.navigation.state).toBe("loading"));
    await user.type(input, "ui_no_match_20261012");
    const keyword = "independent_ui_no_match_20261012";
    expect(input).toHaveValue(keyword);
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("q")).toBe(keyword), { timeout: 2500 });
    expect(input).toHaveValue(keyword);
    await waitFor(() => expect(searchArticles).toHaveBeenLastCalledWith(keyword, 1, 12, undefined));
  });

  it("cancels an uncommitted search when history returns to the same empty keyword", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({ data: { categories: [] } } as never);
    vi.spyOn(articleApi, "listPublicArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const searchArticles = vi.spyOn(articleApi, "searchArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/articles?category=7&page=2"]}>
      <ArticlesPage /><UrlControls />
    </MemoryRouter>);
    const input = screen.getByRole("textbox", { name: "搜索文章" });
    await user.type(input, "discard-this-draft");
    await user.click(screen.getByRole("button", { name: "模拟返回无筛选地址" }));
    expect(input).toHaveValue("");
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(screen.getByLabelText("current URL")).toHaveTextContent("");
    expect(searchArticles).not.toHaveBeenCalled();
  });

  it("commits the full input when choosing a category before the debounce", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { categories: [{ id: 7, name: "信息科技", article_count: 20 }] },
    } as never);
    vi.spyOn(articleApi, "listPublicArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const searchArticles = vi.spyOn(articleApi, "searchArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/articles?page=2&size=24"]}>
      <ArticlesPage /><UrlControls />
    </MemoryRouter>);
    await user.type(screen.getByRole("textbox", { name: "搜索文章" }), "fullkeyword");
    await user.click(await screen.findByRole("button", { name: /信息科技/ }));
    await waitFor(() => expect(searchArticles).toHaveBeenLastCalledWith("fullkeyword", 1, 24, 7));
    const params = new URLSearchParams(screen.getByLabelText("current URL").textContent!);
    expect(params.get("q")).toBe("fullkeyword");
    expect(params.get("page")).toBe("1");
  });

  it("restores search, category, page and page size from a refreshed URL", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { categories: [{ id: 7, name: "信息科技", article_count: 30 }] },
    } as never);
    const search = vi.spyOn(articleApi, "searchArticles").mockResolvedValue({
      data: { ...emptyArticleList, total: 30, articles: [{ id: 1, title: "保留结果", slug: "retained" }] },
    } as never);
    render(<MemoryRouter initialEntries={["/articles?category=7&page=2&size=24&q=python"]}>
      <ArticlesPage /><UrlControls />
    </MemoryRouter>);
    expect(screen.getByRole("textbox", { name: "搜索文章" })).toHaveValue("python");
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("python", 2, 24, 7));
    expect(screen.getByRole("button", { name: /信息科技/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("writes changed keywords and page size to URL and resets the page", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({ data: { categories: [] } } as never);
    vi.spyOn(articleApi, "listPublicArticles").mockResolvedValue({
      data: { ...emptyArticleList, total: 30, articles: [{ id: 1, title: "结果", slug: "result" }] },
    } as never);
    const search = vi.spyOn(articleApi, "searchArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/articles?page=2&category=7"]}>
      <ArticlesPage /><UrlControls />
    </MemoryRouter>);
    await user.selectOptions(await screen.findByRole("combobox", { name: "每页条数" }), "24");
    await user.type(screen.getByRole("textbox", { name: "搜索文章" }), "needle");
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("needle", 1, 24, 7), { timeout: 2500 });
    const params = new URLSearchParams(screen.getByLabelText("current URL").textContent!);
    expect(Object.fromEntries(params)).toEqual({ page: "1", category: "7", size: "24", q: "needle" });
  });

  it("clears category and search when browser navigation returns to an unfiltered URL", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { categories: [{ id: 7, name: "信息科技", article_count: 30 }] },
    } as never);
    vi.spyOn(articleApi, "searchArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const list = vi.spyOn(articleApi, "listPublicArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/articles?category=7&q=python&page=2&size=24"]}>
      <ArticlesPage /><UrlControls />
    </MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "模拟返回无筛选地址" }));
    expect(screen.getByRole("textbox", { name: "搜索文章" })).toHaveValue("");
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ page: 1, size: 12, category_id: undefined }), { timeout: 2500 });
    expect(screen.getByRole("button", { name: "全部文章" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders a request error instead of a no-results state when search fails", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { total: 0, categories: [], page: 1, size: 50, total_pages: 1 },
    } as never);
    vi.spyOn(articleApi, "listPublicArticles").mockResolvedValue({
      data: emptyArticleList,
    } as never);
    const searchArticles = vi
      .spyOn(articleApi, "searchArticles")
      .mockRejectedValue(new Error("network unavailable"));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ArticlesPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText("搜索文章..."), "python");
    await waitFor(
      () => expect(searchArticles).toHaveBeenCalledWith("python", 1, 12, undefined),
      { timeout: 2500 },
    );

    expect(await screen.findByText("文章列表加载失败")).toBeInTheDocument();
    expect(screen.queryByText("未找到匹配的文章")).not.toBeInTheDocument();
  });

  it("retries the public article request from the error state", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { total: 0, categories: [], page: 1, size: 50, total_pages: 1 },
    } as never);
    const listPublicArticles = vi
      .spyOn(articleApi, "listPublicArticles")
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ data: emptyArticleList } as never);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ArticlesPage />
      </MemoryRouter>,
    );

    const retry = await screen.findByRole("button", { name: "重试" });
    expect(listPublicArticles).toHaveBeenCalledTimes(1);

    await user.click(retry);

    await waitFor(() => expect(listPublicArticles).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("文章列表加载失败")).not.toBeInTheDocument();
    expect(screen.getByText("暂无文章")).toBeInTheDocument();
  });

  it("keeps category selection and pagination usable with a full page of articles", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: {
        categories: [{ id: 7, name: "信息科技", article_count: 20 }],
      },
    } as never);
    const articles = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      slug: `mobile-article-${index + 1}`,
      title: `移动验收文章 ${index + 1}`,
    }));
    const listPublicArticles = vi
      .spyOn(articleApi, "listPublicArticles")
      .mockResolvedValue({ data: { ...emptyArticleList, total: 28, articles } } as never);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/articles?page=2"]}>
        <ArticlesPage />
      </MemoryRouter>,
    );

    await screen.findByText("移动验收文章 12");
    await waitFor(() => expect(listPublicArticles).toHaveBeenLastCalledWith({
      page: 2, size: 12, category_id: undefined,
    }));
    const categories = screen.getByRole("group", { name: "选择文章分类" });
    const category = within(categories).getByRole("button", { name: /信息科技\s*\(20\)/ });
    await user.click(category);

    await waitFor(() => expect(listPublicArticles).toHaveBeenLastCalledWith({
      page: 1, size: 12, category_id: 7,
    }));
    expect(category).toHaveAttribute("aria-pressed", "true");
    expect(within(categories).getByRole("button", { name: "全部文章" }))
      .toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(listPublicArticles).toHaveBeenLastCalledWith({
      page: 2, size: 12, category_id: 7,
    }));

    await user.selectOptions(screen.getByRole("combobox", { name: "每页条数" }), "24");
    await waitFor(() => expect(listPublicArticles).toHaveBeenLastCalledWith({
      page: 1, size: 24, category_id: 7,
    }));
  });

  it("preserves combined search and category requests and clears both from the filters", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { categories: [{ id: 7, name: "信息科技", article_count: 20 }] },
    } as never);
    const listPublicArticles = vi
      .spyOn(articleApi, "listPublicArticles")
      .mockResolvedValue({ data: emptyArticleList } as never);
    const searchArticles = vi
      .spyOn(articleApi, "searchArticles")
      .mockResolvedValue({ data: emptyArticleList } as never);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ArticlesPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /信息科技\s*\(20\)/ }));
    const search = screen.getByRole("textbox", { name: "搜索文章" });
    await user.type(search, "python{Enter}");
    await waitFor(
      () => expect(searchArticles).toHaveBeenLastCalledWith("python", 1, 12, 7),
      { timeout: 2500 },
    );
    await user.click(screen.getByRole("button", { name: "清除搜索和分类" }));

    expect(search).toHaveValue("");
    await waitFor(() => expect(listPublicArticles).toHaveBeenLastCalledWith({
      page: 1, size: 12, category_id: undefined,
    }));
    expect(screen.getByRole("button", { name: "全部文章" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "清除搜索和分类" })).toBeDisabled();
  });

  it("lets the keyboard move from search to clear and choose a category", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { categories: [{ id: 7, name: "信息科技", article_count: 20 }] },
    } as never);
    const listPublicArticles = vi
      .spyOn(articleApi, "listPublicArticles")
      .mockResolvedValue({ data: emptyArticleList } as never);
    vi.spyOn(articleApi, "searchArticles").mockResolvedValue({ data: emptyArticleList } as never);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ArticlesPage />
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: /信息科技\s*\(20\)/ });

    await user.tab();
    expect(screen.getByRole("textbox", { name: "搜索文章" })).toHaveFocus();
    await user.keyboard("python");
    await user.tab();
    expect(screen.getByRole("button", { name: "清除搜索和分类" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "搜索文章" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "全部文章" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /信息科技\s*\(20\)/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(listPublicArticles).toHaveBeenLastCalledWith({
      page: 1, size: 12, category_id: 7,
    }));
  });

  it.each([true, false])("only scrolls focused horizontal categories on mobile (mobile=%s)", async (mobile) => {
    const matchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      ...matchMedia(query),
      matches: mobile,
    }));
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { categories: [{ id: 7, name: "信息科技", article_count: 20 }] },
    } as never);
    vi.spyOn(articleApi, "listPublicArticles").mockResolvedValue({
      data: emptyArticleList,
    } as never);
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ArticlesPage />
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: /信息科技\s*\(20\)/ });

    await user.tab();
    await user.tab();

    expect(screen.getByRole("button", { name: "全部文章" })).toHaveFocus();
    if (mobile) {
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "nearest",
        inline: "nearest",
      });
      expect(scrollIntoView.mock.contexts.at(-1))
        .toBe(screen.getByRole("button", { name: "全部文章" }));
    } else {
      expect(scrollIntoView).not.toHaveBeenCalled();
    }

    await user.tab();
    const category = screen.getByRole("button", { name: /信息科技\s*\(20\)/ });
    expect(category).toHaveFocus();
    if (mobile) {
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(category);
    } else {
      expect(scrollIntoView).not.toHaveBeenCalled();
    }
  });

  it("moves between left filters and right pagination with forward and reverse Tab", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { categories: [{ id: 7, name: "信息科技", article_count: 28 }] },
    } as never);
    const listPublicArticles = vi.spyOn(articleApi, "listPublicArticles")
      .mockResolvedValue({
        data: { ...emptyArticleList, total: 28, articles: [
          { id: 1, slug: "keyboard-article", title: "键盘验收文章" },
        ] },
      } as never);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ArticlesPage />
      </MemoryRouter>,
    );
    await screen.findByText("键盘验收文章");
    const filters = screen.getByRole("complementary", { name: "文章筛选" });
    const results = screen.getByRole("region", { name: "文章列表" });
    const category = within(filters).getByRole("button", { name: /信息科技\s*\(28\)/ });
    const pageSize = within(results).getByRole("combobox", { name: "每页条数" });
    const article = within(results).getByRole("button", { name: "键盘验收文章" });
    expect(within(results).queryByRole("textbox", { name: "搜索文章" })).toBeNull();

    await user.tab();
    expect(within(filters).getByRole("textbox", { name: "搜索文章" })).toHaveFocus();
    await user.tab();
    expect(within(filters).getByRole("button", { name: "全部文章" })).toHaveFocus();
    await user.tab();
    expect(category).toHaveFocus();
    await user.tab();
    expect(article).toHaveFocus();
    await user.tab();
    expect(pageSize).toHaveFocus();
    await user.tab();
    expect(within(results).getByRole("button", { name: "下一页" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(pageSize).toHaveFocus();
    await user.tab({ shift: true });
    expect(article).toHaveFocus();
    await user.tab({ shift: true });
    expect(category).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(listPublicArticles).toHaveBeenLastCalledWith({
      page: 1, size: 12, category_id: 7,
    }));
  });

  it.each(["{Enter}", " "])("opens an article with native keyboard activation (%s) without submitting a form", async (key) => {
    const openArticle = vi.fn();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={submit}>
        <ArticleItem
          article={{ id: 1, slug: "keyboard-article", title: "键盘验收文章" } as never}
          onClick={openArticle}
        />
      </form>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "键盘验收文章" })).toHaveFocus();
    await user.keyboard(key);

    expect(openArticle).toHaveBeenCalledExactlyOnceWith("keyboard-article");
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not offer an actionable article button without a slug", async () => {
    const openArticle = vi.fn();
    const user = userEvent.setup();
    render(
      <ArticleItem article={{ id: 1, title: "无链接文章" } as never} onClick={openArticle} />,
    );

    const article = screen.getByRole("button", { name: "无链接文章" });
    expect(article).toBeDisabled();
    await user.click(article);
    expect(openArticle).not.toHaveBeenCalled();
  });
});
