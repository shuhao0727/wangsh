import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showMessage } from "@/lib/toast";
import { api } from "@services";
import { ML_BOOK } from "@/pages/Admin/ITTechnology/ml/book";
import LearningEditorPage from "@/pages/Admin/ITTechnology/learning/EditorPage";
import MlBookEditor from "@/pages/Admin/ITTechnology/ml/editor/MlBookEditor";
import { mlBookAdminApi } from "@/services/ml/books";
import {
  fetchLearningContentPayload,
  mergeLearningBookChapters,
  type PersistedLearningChapter,
} from "@/pages/Admin/ITTechnology/learning/helpers";
import type { LearningBook } from "@/pages/Admin/ITTechnology/learning/types";

vi.mock("@/lib/toast", () => ({
  showMessage: { success: vi.fn(), error: vi.fn() },
}));

const reads = vi.hoisted(() => ({ sources: vi.fn(), readBack: vi.fn() }));
vi.mock("@services", () => ({
  api: { get: vi.fn((url: string) => /^\/learning\/(content|chapters)\/[^/]+$/.test(url)
    ? reads.sources(url) : reads.readBack(url)), put: vi.fn() },
}));

vi.mock("@/services/ml/books", () => ({
  mlBookAdminApi: {
    getBook: vi.fn(), getChapter: vi.fn(), upsertChapter: vi.fn(),
  },
}));

vi.mock("@/pages/Admin/ITTechnology/learning/BookReader", () => ({
  BookReader: ({ book }: { book: { chapters: Array<{ markdown: string }> } }) => (
    <div data-testid="book-reader">{book.chapters[0]?.markdown}</div>
  ),
}));

const syntheticBook: LearningBook = {
  moduleKey: "ml",
  title: "Synthetic book",
  subtitle: "",
  description: "",
  audience: "",
  outcomes: [],
  chapters: [
    {
      slug: "chapter-a",
      title: "Bundled A",
      summary: "Bundled summary",
      estimatedMinutes: 30,
      difficulty: "beginner",
      goals: ["retain"],
      markdown: "RAW-A",
      checklist: ["keep"],
      experiments: [],
      glossary: [],
      references: [],
    },
    {
      slug: "chapter-b",
      title: "Bundled B",
      summary: "B",
      estimatedMinutes: 20,
      difficulty: "intermediate",
      goals: [],
      markdown: "RAW-B",
      checklist: [],
      experiments: [],
      glossary: [],
      references: [],
    },
  ],
};

const saved: PersistedLearningChapter[] = [
  {
    slug: "chapter-a",
    title: "Saved A",
    summary: "Saved summary",
    estimated_minutes: 12,
    difficulty: "advanced",
    group_name: "Saved group",
    markdown: "SYS-A",
    sort_order: 0,
  },
  {
    slug: "chapter-c",
    title: "Saved C",
    summary: "C",
    estimated_minutes: 8,
    difficulty: "beginner",
    markdown: "SYS-C",
    sort_order: 2,
  },
];

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
};

const mount = (module = "ml") => render(
  <MemoryRouter initialEntries={[`/admin/it-technology/learning/editor/${module}`]}>
    <Routes>
      <Route path="/admin/it-technology/learning/editor/:moduleKey" element={<LearningEditorPage />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  reads.sources.mockReset();
  reads.readBack.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("learning chapter canonical source", () => {
  it("overlays persisted fields while retaining bundled metadata and order", () => {
    const merged = mergeLearningBookChapters(syntheticBook, saved);

    expect(merged.chapters.map((chapter) => chapter.slug)).toEqual([
      "chapter-a",
      "chapter-b",
      "chapter-c",
    ]);
    expect(merged.chapters[0]).toMatchObject({
      title: "Saved A",
      markdown: "SYS-A",
      estimatedMinutes: 12,
      difficulty: "advanced",
      group: "Saved group",
      goals: ["retain"],
      checklist: ["keep"],
    });
    expect(merged.chapters[1].markdown).toBe("RAW-B");
    expect(merged.chapters[2]).toMatchObject({
      title: "Saved C",
      markdown: "SYS-C",
      estimatedMinutes: 8,
    });
  });

  it("keeps the fallback path when both database sources return 503", async () => {
    reads.sources.mockRejectedValue({ response: { status: 503 } });

    await expect(fetchLearningContentPayload("ml")).resolves.toBeNull();
  });

  it("uses persisted chapters when raw content and chapter endpoints both succeed", async () => {
    reads.sources.mockImplementation((url: string) => {
        if (url.includes("/learning/content/")) {
          return Promise.resolve({
            data: [{
              section_key: "raw",
              item_key: "book",
              enabled: true,
              content: { book: syntheticBook },
            }],
          });
        }
        return Promise.resolve({ data: saved });
    });

    const payload = await fetchLearningContentPayload<{ book: LearningBook }>("ml");
    expect(payload?.book?.chapters[0].markdown).toBe("SYS-A");
    expect(payload?.book?.chapters[0].goals).toEqual(["retain"]);
  });

  it("keeps bundled content visible when the editor chapter endpoint returns 503", async () => {
    reads.sources.mockRejectedValue({ response: { status: 503 } });

    mount();

    const textarea = await screen.findByRole("textbox");
    expect(textarea).toHaveValue(ML_BOOK.chapters[0].markdown);
    expect(screen.getByRole("button", { name: /^保存$/ })).toBeDisabled();
    expect(showMessage.error).not.toHaveBeenCalled();
  });

  it.each(["ml", "ai", "agents"])("loads the %s raw book structure as the reader before overlaying saved chapters", async (module) => {
    reads.sources.mockImplementation((url: string) => Promise.resolve({
      data: url.includes("/learning/content/") ? [{
        section_key: "raw", item_key: "book", enabled: true,
        content: { book: syntheticBook },
      }] : saved,
    }));
    mount(module);
    const textarea = await screen.findByRole("textbox");
    expect(textarea).toHaveValue("SYS-A");
    fireEvent.click(screen.getByRole("button", { name: /Bundled B/ }));
    expect(textarea).toHaveValue("RAW-B");
  });

  it("keeps a failed save draft and cached chapter unchanged", async () => {
    reads.sources.mockImplementation((url: string) => Promise.resolve({
      data: url.includes("/learning/content/") ? [{
        section_key: "raw", item_key: "book", content: { book: syntheticBook },
      }] : [],
    }));
    vi.mocked(api.put).mockRejectedValueOnce(new Error("503"));
    mount();
    const textarea = await screen.findByRole("textbox");
    fireEvent.change(textarea, { target: { value: "UNSAVED-DRAFT" } });
    fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
    await waitFor(() => expect(showMessage.error).toHaveBeenCalledWith("保存失败"));
    expect(textarea).toHaveValue("UNSAVED-DRAFT");
    fireEvent.click(screen.getByRole("button", { name: /Bundled B/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bundled A/ }));
    expect(textarea).toHaveValue("RAW-A");
    expect(showMessage.success).not.toHaveBeenCalled();
  });

  it("does not overwrite edits typed while the same chapter is being saved", async () => {
    reads.sources.mockImplementation((url: string) => Promise.resolve({
      data: url.includes("/learning/content/") ? [{
        section_key: "raw", item_key: "book", content: { book: syntheticBook },
      }] : [],
    }));
    const put = deferred<unknown>();
    vi.mocked(api.put).mockReturnValueOnce(put.promise as never);
    reads.readBack.mockResolvedValueOnce({ data: { slug: "chapter-a", markdown: "SAVED-A" } });
    mount();
    const textarea = await screen.findByRole("textbox");
    fireEvent.change(textarea, { target: { value: "SAVED-A" } });
    fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
    fireEvent.change(textarea, { target: { value: "NEWER-DRAFT" } });
    put.resolve({ data: {} });
    await waitFor(() => expect(showMessage.success).toHaveBeenCalled());
    expect(textarea).toHaveValue("NEWER-DRAFT");
    fireEvent.click(screen.getByRole("button", { name: /Bundled B/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bundled A/ }));
    expect(textarea).toHaveValue("SAVED-A");
  });

  it("retains the saved order when an individual chapter is merged after read-back", () => {
    const original = mergeLearningBookChapters(syntheticBook, [
      { slug: "chapter-a", markdown: "A", sort_order: 5 },
      { slug: "chapter-b", markdown: "B", sort_order: 8 },
    ]);
    const merged = mergeLearningBookChapters(original, [
      { slug: "chapter-a", markdown: "UPDATED-A", sort_order: 5 },
    ]);
    expect(merged.chapters.map((c) => c.slug)).toEqual(["chapter-a", "chapter-b"]);
  });

  it.each(["content", "chapters"])("blocks fallback saves when just the %s source fails", async (failedSource) => {
    reads.sources.mockImplementation((url: string) => url.includes(`/learning/${failedSource}/`)
      ? Promise.reject({ response: { status: 503 } })
      : Promise.resolve({ data: [] }));
    mount();
    expect(await screen.findByRole("textbox")).toHaveValue(ML_BOOK.chapters[0].markdown);
    expect(screen.getByRole("button", { name: /^保存$/ })).toBeDisabled();
  });

  it("leaves a new ML chapter draft untouched while an older chapter save returns", async () => {
    const chapter = { slug: "old", title: "Old ML", chapter_number: 1,
      markdown: "OLD-SERVER", sort_order: 0, enabled: true };
    vi.mocked(mlBookAdminApi.getBook).mockResolvedValue({
      data: { book: { id: 1, title: "ML fixture", chapters: [chapter] } },
    } as never);
    const put = deferred<unknown>();
    vi.mocked(mlBookAdminApi.upsertChapter).mockReturnValueOnce(put.promise as never);
    vi.mocked(mlBookAdminApi.getChapter).mockResolvedValueOnce({
      data: { chapter: { ...chapter, markdown: "ML-SAVED" } },
    } as never);
    render(<MemoryRouter><MlBookEditor /></MemoryRouter>);
    const textarea = await screen.findByPlaceholderText(/输入章节 Markdown/);
    fireEvent.change(textarea, { target: { value: "ML-SAVED" } });
    fireEvent.click(screen.getByRole("button", { name: /保存 \(⌘S\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /新增章节/ }));
    fireEvent.change(screen.getByPlaceholderText("章节标题"), { target: { value: "New ML" } });
    fireEvent.change(textarea, { target: { value: "NEW-ML-DRAFT" } });
    put.resolve({ data: {} });
    await waitFor(() => expect(mlBookAdminApi.getChapter).toHaveBeenCalledWith("ml", "old"));
    await waitFor(() => expect(screen.getByRole("button", { name: /保存 \(⌘S\)/ })).toBeEnabled());
    expect(textarea).toHaveValue("NEW-ML-DRAFT");
    expect(screen.getByPlaceholderText("章节标题")).toHaveValue("New ML");
    fireEvent.click(screen.getByText("Old ML", { selector: "span" }));
    expect(textarea).toHaveValue("ML-SAVED");
  });

  it("does not let a late save response for the old chapter replace the new chapter draft", async () => {
    const savedChapters = [
      {
        slug: ML_BOOK.chapters[0].slug,
        title: ML_BOOK.chapters[0].title,
        summary: ML_BOOK.chapters[0].summary,
        estimated_minutes: ML_BOOK.chapters[0].estimatedMinutes,
        difficulty: ML_BOOK.chapters[0].difficulty,
        group_name: ML_BOOK.chapters[0].group ?? null,
        markdown: "SERVER-FIRST",
        sort_order: 0,
      },
      {
        slug: ML_BOOK.chapters[1].slug,
        title: ML_BOOK.chapters[1].title,
        summary: ML_BOOK.chapters[1].summary,
        estimated_minutes: ML_BOOK.chapters[1].estimatedMinutes,
        difficulty: ML_BOOK.chapters[1].difficulty,
        group_name: ML_BOOK.chapters[1].group ?? null,
        markdown: "SERVER-SECOND",
        sort_order: 1,
      },
    ];
    reads.sources.mockResolvedValue({ data: savedChapters });
    const put = deferred<unknown>();
    const readBack = deferred<unknown>();
    vi.mocked(api.put).mockReturnValue(put.promise as never);
    reads.readBack.mockReturnValue(readBack.promise);

    mount();

    const textarea = await screen.findByRole("textbox");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ML_BOOK.chapters[1].title) }));
    expect(textarea).toHaveValue("SERVER-SECOND");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ML_BOOK.chapters[0].title) }));
    expect(textarea).toHaveValue("SERVER-FIRST");
    fireEvent.change(textarea, { target: { value: "LOCAL-FIRST" } });
    fireEvent.click(screen.getByRole("button", { name: /^保存$/ }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ML_BOOK.chapters[1].title) }));
    expect(textarea).toHaveValue("SERVER-SECOND");

    put.resolve({ data: {} });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      `/learning/chapters/ml/${ML_BOOK.chapters[0].slug}`,
    ));
    readBack.resolve({
      data: {
        slug: ML_BOOK.chapters[0].slug,
        markdown: "LOCAL-FIRST",
        title: ML_BOOK.chapters[0].title,
        summary: ML_BOOK.chapters[0].summary,
        estimated_minutes: ML_BOOK.chapters[0].estimatedMinutes,
        difficulty: ML_BOOK.chapters[0].difficulty,
        group_name: ML_BOOK.chapters[0].group ?? null,
        sort_order: 0,
      },
    });

    await waitFor(() => expect(textarea).toHaveValue("SERVER-SECOND"));
    expect(showMessage.success).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ML_BOOK.chapters[0].title) }));
    expect(textarea).toHaveValue("LOCAL-FIRST");
  });

  it("accepts a read-back for a newly generated ML slug", async () => {
    vi.mocked(mlBookAdminApi.getBook).mockResolvedValue({
      data: { book: { id: 1, title: "Synthetic ML", chapters: [] } },
    } as never);
    vi.mocked(mlBookAdminApi.upsertChapter).mockResolvedValue({ data: {} } as never);
    vi.mocked(mlBookAdminApi.getChapter).mockResolvedValue({ data: { chapter: {
      slug: "new-chapter", title: "New chapter", chapter_number: 1,
      markdown: "SERVER-NEW", sort_order: 0, enabled: true,
    } } } as never);
    render(<MemoryRouter><MlBookEditor /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /新增章节/ }));
    fireEvent.change(screen.getByPlaceholderText("章节标题"), { target: { value: "New chapter" } });
    fireEvent.click(screen.getByRole("button", { name: /保存 \(⌘S\)/ }));
    await waitFor(() => expect(showMessage.success).toHaveBeenCalledWith("章节已保存"));
    expect(screen.getByPlaceholderText("章节标题")).toHaveValue("New chapter");
    expect(screen.getByPlaceholderText(/输入章节 Markdown/)).toHaveValue("SERVER-NEW");
  });
});
