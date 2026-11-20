import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosHeaders, type AxiosResponse } from "axios";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import MlBookEditor from "@/pages/Admin/ITTechnology/ml/editor/MlBookEditor";
import { showMessage } from "@/lib/toast";
import { mlBookAdminApi, type MLBookChapter } from "@/services/ml/books";

vi.mock("@/lib/toast", () => ({ showMessage: { error: vi.fn() } }));

afterEach(() => vi.restoreAllMocks());

const successResponse = <T,>(data: T): AxiosResponse<T> => ({
  data, status: 200, statusText: "OK", headers: {}, config: { headers: new AxiosHeaders() },
});

it("keeps the saved chapter order after a failed drag and allows retry", async () => {
  const chapters = ["第一章", "第二章"].map((title, index): MLBookChapter => ({
    id: index + 1, book_id: 1, title, slug: `chapter-${index + 1}`,
    chapter_number: index + 1, sort_order: index + 1, enabled: true, markdown: "合成正文",
    goals: [], checklist: [], experiments: [], glossary: [], references: [], prerequisites: [],
    keywords: [], quiz: [],
  }));
  vi.spyOn(mlBookAdminApi, "getBook").mockResolvedValue(successResponse({
    book: { id: 1, module_key: "ml", title: "合成书", outcomes: [], enabled: true, chapters },
  }));
  const reorder = vi.spyOn(mlBookAdminApi, "reorderChapters")
    .mockRejectedValueOnce(new Error("503"))
    .mockResolvedValueOnce(successResponse({}));

  render(<MemoryRouter><MlBookEditor /></MemoryRouter>);
  const list = await screen.findByRole("navigation", { name: "书籍章节" });
  const first = within(list).getByText("第一章").closest("[draggable]")!;
  const second = within(list).getByText("第二章").closest("[draggable]")!;
  const dragFirstAfterSecond = () => {
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (key: string, value: string) => data.set(key, value),
      getData: (key: string) => data.get(key),
    };
    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.drop(second, { dataTransfer });
  };

  dragFirstAfterSecond();
  await waitFor(() => expect(showMessage.error).toHaveBeenCalledWith("排序保存失败"));
  expect(list.querySelector("[draggable]")).toBe(first);

  dragFirstAfterSecond();
  await waitFor(() => expect(list.querySelector("[draggable]")).toBe(second));
  expect(reorder).toHaveBeenLastCalledWith("ml", [
    { slug: "chapter-2", chapter_number: 1 }, { slug: "chapter-1", chapter_number: 2 },
  ]);
});
