import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ArticlesPage from "@/pages/Articles";
import ArticleItem from "@/pages/Articles/components/ArticleItem";
import { articleApi, categoryApi, type ArticleWithRelations } from "@/services";

const article = {
  id: 1,
  slug: "public-ui-polish",
  title: "课堂实践文章",
  summary: "较长摘要保留完整内容，窄屏排版由文章页样式负责。",
  created_at: "2026-10-12T10:00:00Z",
  category: { id: 7, name: "人工智能与课堂实践的较长分类名称", slug: "classroom" },
  author: { id: 1, username: "public_ui_author_with_a_very_long_username", full_name: null },
} as ArticleWithRelations;

function CurrentUrl() {
  return <output aria-label="当前地址参数">{useLocation().search}</output>;
}

describe("public-ui article polish compatibility", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retains complete metadata and exposes the displayed date as a semantic time", async () => {
    const openArticle = vi.fn();
    const user = userEvent.setup();
    render(<ArticleItem article={article} onClick={openArticle} />);

    const row = screen.getByRole("button", { name: article.title });
    expect(within(row).getByText(article.summary)).toBeInTheDocument();
    expect(within(row).getByText(article.category!.name)).toBeInTheDocument();
    expect(within(row).getByText(article.author.username)).toBeInTheDocument();
    const date = within(row).getByText("2026-10-12");
    expect(date.tagName).toBe("TIME");
    expect(date).toHaveAttribute("datetime", "2026-10-12");

    await user.hover(row);
    await user.click(row);
    expect(openArticle).toHaveBeenCalledExactlyOnceWith(article.slug);
  });

  it("renders optional metadata safely without creating a date or an actionable missing slug", () => {
    const openArticle = vi.fn();
    const { container } = render(
      <ArticleItem article={{ id: 2, title: "暂无链接" } as ArticleWithRelations} onClick={openArticle} />,
    );
    expect(screen.getByRole("button", { name: "暂无链接" })).toBeDisabled();
    expect(container.querySelector("time")).toBeNull();
    expect(openArticle).not.toHaveBeenCalled();
  });

  it("clears search and category by keyboard, keeps page size, and restores input focus", async () => {
    vi.spyOn(categoryApi, "listPublicCategories").mockResolvedValue({
      data: { categories: [{ id: 7, name: "课堂实践", article_count: 34 }] },
    } as never);
    const list = vi.spyOn(articleApi, "listPublicArticles").mockResolvedValue({
      data: { articles: [article], total: 34 },
    } as never);
    vi.spyOn(articleApi, "searchArticles").mockResolvedValue({
      data: { articles: [], total: 0 },
    } as never);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/articles?category=7&q=AI&page=2&size=24"]}>
        <ArticlesPage />
        <CurrentUrl />
      </MemoryRouter>,
    );

    const reset = screen.getByRole("button", { name: "清除搜索和分类" });
    expect(reset).toBeEnabled();
    const search = screen.getByRole("textbox", { name: "搜索文章" });
    search.focus();
    await user.tab();
    expect(reset).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ page: 1, size: 24, category_id: undefined }));
    const params = new URLSearchParams(screen.getByLabelText("当前地址参数").textContent || "");
    expect(params.get("page")).toBe("1");
    expect(params.get("size")).toBe("24");
    expect(params.has("q")).toBe(false);
    expect(params.has("category")).toBe(false);
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(screen.getByRole("button", { name: "全部文章" })).toHaveAttribute("aria-pressed", "true");
    expect(reset).toBeDisabled();
  });
});
