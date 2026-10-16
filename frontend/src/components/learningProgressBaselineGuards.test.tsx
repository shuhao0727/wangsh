import { StrictMode, type ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MLPage from "@/pages/Admin/ITTechnology/ml";
import AIPage from "@/pages/Admin/ITTechnology/ai";
import AgentsPage from "@/pages/Admin/ITTechnology/agents";

type ReaderProps = ComponentProps<
  typeof import("@/pages/Admin/ITTechnology/learning/BookReader").BookReader
>;
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  contentGet: vi.fn(),
  readerProps: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@services", () => ({
  api: {
    get: (url: string, config?: unknown) =>
      url.startsWith("/learning/content/")
        ? mocks.contentGet(url, config)
        : mocks.get(url),
    patch: mocks.patch,
  },
}));
vi.mock("@/services/api", () => ({
  api: {
    get: (url: string, config?: unknown) =>
      url.startsWith("/learning/content/")
        ? mocks.contentGet(url, config)
        : mocks.get(url),
    patch: mocks.patch,
  },
  default: mocks,
}));
vi.mock("@/lib/toast", () => ({
  showMessage: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/pages/Admin/ITTechnology/learning/helpers", async (original) => ({
  ...(await original<
    typeof import("@/pages/Admin/ITTechnology/learning/helpers")
  >()),
  fetchLearningContentPayload: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/pages/Admin/ITTechnology/learning/MindMapViewer", () => ({
  default: () => <div>学习地图</div>,
}));
// Render the real reader. Capture its props solely to test the page callback boundary:
// the current BookReader does not render chapter-complete/favorite controls.
vi.mock("@/pages/Admin/ITTechnology/learning/BookReader", async (original) => {
  const actual =
    await original<
      typeof import("@/pages/Admin/ITTechnology/learning/BookReader")
    >();
  return {
    ...actual,
    BookReader: (props: ReaderProps) => {
      mocks.readerProps(props);
      return <actual.BookReader {...props} />;
    },
  };
});
const invokeChapterCallbacks = () =>
  act(() => {
    const props = mocks.readerProps.mock.lastCall![0] as ReaderProps;
    props.onToggleComplete("fixture");
    props.onToggleFavorite("fixture");
  });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const envelope = (
  version = "baseline-version",
  completedItems: Record<string, boolean> = {},
) => ({
  data: {
    id: 1,
    version,
    data: {
      notes: "retained server note",
      stages: {},
      completedItems,
      favoriteItems: {},
      completedChapters: {},
      favoriteChapters: {},
    },
  },
});
const cases = [
  {
    module: "ml",
    Page: MLPage,
    first: "从零实现线性回归",
    second: "Pandas 数据探索与可视化实战",
  },
  {
    module: "ai",
    Page: AIPage,
    first: "Prompt 对决：谁能让 AI 算对数学题",
    second: "AI 画画：提示词调优实验室",
  },
  {
    module: "agents",
    Page: AgentsPage,
    first: "Hello World Agent",
    second: "天气查询 Agent",
  },
];
const card = (name: string) =>
  screen
    .getAllByRole("heading", { name })
    .map((heading) => heading.closest(".cursor-pointer"))
    .find(Boolean) as HTMLElement;
const switchTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
const mount = (Page: typeof MLPage, module: string, strict = false) => {
  const element = (
    <MemoryRouter initialEntries={[`/it-technology/${module}?tab=experiments`]}>
      <Page embedded />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{element}</StrictMode> : element);
};

beforeEach(() => {
  mocks.get.mockReset();
  mocks.patch.mockReset();
  mocks.readerProps.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
  mocks.contentGet.mockReset().mockResolvedValue({ data: [] });
});
afterEach(() => {
  vi.clearAllMocks();
});

describe.each(cases)(
  "$module progress baseline write protection",
  ({ module, Page, first, second }) => {
    it("reads the module mindmap through the shared API and aborts on unmount", async () => {
      mocks.get.mockResolvedValue(envelope());
      const view = mount(Page, module);
      await waitFor(() =>
        expect(mocks.contentGet).toHaveBeenCalledWith(
          `/learning/content/${module}`,
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      const signal = mocks.contentGet.mock.calls[0][1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
      view.unmount();
      expect(signal.aborted).toBe(true);
    });

    it("locks experiment writes and reader callbacks until GET succeeds, then permits a versioned save", async () => {
      const pending = deferred<ReturnType<typeof envelope>>();
      mocks.get.mockReturnValue(pending.promise);
      mocks.patch.mockResolvedValue(envelope("saved-version"));
      mount(Page, module);
      expect(mocks.get).toHaveBeenCalledWith(`/learning/progress/${module}`);
      expect(screen.getByRole("status")).toHaveTextContent("正在读取学习进度");
      const mark = within(card(first)).getByRole("button", { name: "标记" });
      const favorite = within(card(first)).getAllByRole("button")[0];
      expect(mark).toBeDisabled();
      expect(favorite).toBeDisabled();
      fireEvent.click(mark);
      fireEvent.click(favorite);
      fireEvent.click(card(first));
      expect(screen.getByRole("button", { name: "标记完成" })).toBeDisabled();
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
      switchTab("学习书");
      invokeChapterCallbacks();
      expect(
        (mocks.readerProps.mock.lastCall![0] as ReaderProps).completedChapters,
      ).not.toHaveProperty("fixture");
      expect(
        (mocks.readerProps.mock.lastCall![0] as ReaderProps).favoriteChapters,
      ).not.toHaveProperty("fixture");
      expect(screen.getByRole("button", { name: "保存进度" })).toBeDisabled();
      expect(mocks.patch).not.toHaveBeenCalled();
      await act(async () => {
        pending.resolve(envelope());
      });
      expect(screen.queryByText(/正在读取学习进度/)).not.toBeInTheDocument();
      switchTab("动手实验");
      const readyMark = within(card(first)).getByRole("button", {
        name: "标记",
      });
      expect(readyMark).toBeEnabled();
      fireEvent.click(readyMark);
      switchTab("学习书");
      fireEvent.click(screen.getByRole("button", { name: "保存进度" }));
      await waitFor(() =>
        expect(mocks.patch).toHaveBeenCalledWith(
          `/learning/progress/${module}`,
          expect.objectContaining({
            version: "baseline-version",
            notes: "retained server note",
            completedItems: { [`experiment:${first}`]: true },
            favoriteItems: {},
            completedChapters: {},
            favoriteChapters: {},
          }),
        ),
      );
    });

    it("keeps writes disabled after 503 and exposes retry in the experiments tab", async () => {
      mocks.get
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValue(envelope());
      mount(Page, module);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "学习进度读取失败",
      );
      expect(
        within(card(first)).getByRole("button", { name: "标记" }),
      ).toBeDisabled();
      expect(within(card(first)).getAllByRole("button")[0]).toBeDisabled();
      expect(mocks.patch).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "重试读取" }));
      await waitFor(() =>
        expect(
          within(card(first)).getByRole("button", { name: "标记" }),
        ).toBeEnabled(),
      );
      expect(mocks.get).toHaveBeenCalledTimes(2);
    });

    it("also locks resource favorites until the baseline is ready", async () => {
      const pending = deferred<ReturnType<typeof envelope>>();
      mocks.get.mockReturnValue(pending.promise);
      mocks.patch.mockResolvedValue(envelope("resource-saved-version"));
      mount(Page, module);
      switchTab("工具箱");
      const favorite = screen.getAllByRole("button", { name: /^收藏 / })[0];
      const title = favorite.getAttribute("aria-label")!.replace(/^收藏 /, "");
      expect(favorite).toBeDisabled();
      fireEvent.click(favorite);
      await act(async () => {
        pending.resolve(envelope());
      });
      expect(favorite).toBeEnabled();
      fireEvent.click(favorite);
      switchTab("学习书");
      fireEvent.click(screen.getByRole("button", { name: "保存进度" }));
      await waitFor(() =>
        expect(mocks.patch).toHaveBeenCalledWith(
          `/learning/progress/${module}`,
          expect.objectContaining({
            favoriteItems: { [`resource:${title}`]: true },
            version: "baseline-version",
          }),
        ),
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "保存进度" })).toBeEnabled(),
      );
    });

    it("preserves newer edits made while an already loaded save is pending", async () => {
      mocks.get.mockResolvedValue(envelope());
      const pending = deferred<ReturnType<typeof envelope>>();
      mocks.patch
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValue(envelope("latest-version"));
      mount(Page, module);
      await waitFor(() =>
        expect(
          within(card(first)).getByRole("button", { name: "标记" }),
        ).toBeEnabled(),
      );
      fireEvent.click(
        within(card(first)).getByRole("button", { name: "标记" }),
      );
      switchTab("学习书");
      fireEvent.click(screen.getByRole("button", { name: "保存进度" }));
      switchTab("动手实验");
      const newMark = within(card(second)).getByRole("button", {
        name: "标记",
      });
      expect(newMark).toBeEnabled();
      fireEvent.click(newMark);
      await act(async () => {
        pending.resolve(envelope("ack-version"));
      });
      expect(
        within(card(second)).getByRole("button", { name: "已完成" }),
      ).toBeInTheDocument();
      switchTab("学习书");
      fireEvent.click(screen.getByRole("button", { name: "保存进度" }));
      await waitFor(() =>
        expect(mocks.patch).toHaveBeenLastCalledWith(
          `/learning/progress/${module}`,
          expect.objectContaining({
            version: "ack-version",
            completedItems: {
              [`experiment:${first}`]: true,
              [`experiment:${second}`]: true,
            },
          }),
        ),
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "保存进度" })).toBeEnabled(),
      );
    });

    it("locks writes during the 409 re-read and restores the authoritative baseline", async () => {
      const reread = deferred<ReturnType<typeof envelope>>();
      mocks.get
        .mockResolvedValueOnce(envelope())
        .mockReturnValue(reread.promise);
      mocks.patch.mockRejectedValue({ response: { status: 409 } });
      mount(Page, module);
      await waitFor(() =>
        expect(
          within(card(first)).getByRole("button", { name: "标记" }),
        ).toBeEnabled(),
      );
      fireEvent.click(
        within(card(first)).getByRole("button", { name: "标记" }),
      );
      switchTab("学习书");
      fireEvent.click(screen.getByRole("button", { name: "保存进度" }));
      await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
      switchTab("动手实验");
      expect(
        within(card(first)).getByRole("button", { name: "已完成" }),
      ).toBeDisabled();
      expect(
        within(card(second)).getByRole("button", { name: "标记" }),
      ).toBeDisabled();
      await act(async () => {
        reread.resolve(
          envelope("other-tab-version", { [`experiment:${second}`]: true }),
        );
      });
      expect(
        within(card(first)).getByRole("button", { name: "标记" }),
      ).toBeEnabled();
      expect(
        within(card(second)).getByRole("button", { name: "已完成" }),
      ).toBeEnabled();
    });

    it("retains the loaded draft when a conflict re-read fails, and locks further writes", async () => {
      mocks.get
        .mockResolvedValueOnce(envelope())
        .mockRejectedValue({ response: { status: 503 } });
      mocks.patch.mockRejectedValue({ response: { status: 409 } });
      mount(Page, module);
      await waitFor(() =>
        expect(
          within(card(first)).getByRole("button", { name: "标记" }),
        ).toBeEnabled(),
      );
      fireEvent.click(
        within(card(first)).getByRole("button", { name: "标记" }),
      );
      switchTab("学习书");
      fireEvent.click(screen.getByRole("button", { name: "保存进度" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "学习进度读取失败",
      );
      switchTab("动手实验");
      expect(
        within(card(first)).getByRole("button", { name: "已完成" }),
      ).toBeDisabled();
      expect(
        within(card(second)).getByRole("button", { name: "标记" }),
      ).toBeDisabled();
      expect(mocks.patch).toHaveBeenCalledTimes(1);
    });

    it("real book page button rereads failed GET, locks during read/save, then sends the loaded version", async () => {
      const user = userEvent.setup();
      const reread = deferred<ReturnType<typeof envelope>>();
      const saved = deferred<ReturnType<typeof envelope>>();
      mocks.get
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockReturnValue(reread.promise);
      mocks.patch
        .mockReturnValueOnce(saved.promise)
        .mockResolvedValue(envelope("second-save"));
      mount(Page, module);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "学习进度读取失败",
      );
      switchTab("学习书");
      // These are actual product DOM controls, not buttons invented by a reader mock.
      expect(
        screen.getByRole("button", { name: "章节目录" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "chapter complete" }),
      ).not.toBeInTheDocument();
      invokeChapterCallbacks();
      expect(
        (mocks.readerProps.mock.lastCall![0] as ReaderProps).completedChapters,
      ).not.toHaveProperty("fixture");
      expect(
        (mocks.readerProps.mock.lastCall![0] as ReaderProps).favoriteChapters,
      ).not.toHaveProperty("fixture");
      await user.click(screen.getByRole("button", { name: "重新读取" }));
      expect(mocks.get).toHaveBeenCalledTimes(2);
      expect(mocks.patch).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "保存进度" })).toBeDisabled();
      invokeChapterCallbacks();
      expect(
        (mocks.readerProps.mock.lastCall![0] as ReaderProps).completedChapters,
      ).not.toHaveProperty("fixture");
      expect(
        (mocks.readerProps.mock.lastCall![0] as ReaderProps).favoriteChapters,
      ).not.toHaveProperty("fixture");
      await user.click(screen.getByRole("button", { name: "保存进度" }));
      expect(mocks.patch).not.toHaveBeenCalled();
      await act(async () => {
        reread.resolve(envelope("reread-version"));
      });
      await user.click(screen.getByRole("button", { name: "保存进度" }));
      expect(mocks.patch).toHaveBeenCalledTimes(1);
      expect(mocks.patch).toHaveBeenLastCalledWith(
        `/learning/progress/${module}`,
        expect.objectContaining({
          version: "reread-version",
          notes: "retained server note",
          completedChapters: {},
          favoriteChapters: {},
        }),
      );
      expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();
      await user.click(screen.getByRole("button", { name: "保存中..." }));
      expect(mocks.patch).toHaveBeenCalledTimes(1);
      await act(async () => {
        saved.resolve(envelope("acknowledged-version"));
      });
      await user.click(screen.getByRole("button", { name: "保存进度" }));
      expect(mocks.patch).toHaveBeenLastCalledWith(
        `/learning/progress/${module}`,
        expect.objectContaining({ version: "acknowledged-version" }),
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "保存进度" })).toBeEnabled(),
      );
    });

    it("rejects an obsolete successful GET while the current GET is still loading", async () => {
      const obsolete = deferred<ReturnType<typeof envelope>>();
      const current = deferred<ReturnType<typeof envelope>>();
      mocks.get
        .mockReturnValueOnce(obsolete.promise)
        .mockReturnValueOnce(current.promise);
      mocks.patch.mockResolvedValue(envelope("saved"));
      mount(Page, module, true);
      expect(mocks.get).toHaveBeenCalledTimes(2);
      await act(async () => {
        obsolete.resolve(envelope("obsolete-version"));
      });
      expect(screen.getByRole("status")).toHaveTextContent("正在读取学习进度");
      expect(
        within(card(first)).getByRole("button", { name: "标记" }),
      ).toBeDisabled();
      switchTab("学习书");
      expect(screen.getByRole("button", { name: "保存进度" })).toBeDisabled();
      await act(async () => {
        current.resolve(envelope("current-version"));
      });
      fireEvent.click(screen.getByRole("button", { name: "保存进度" }));
      await waitFor(() =>
        expect(mocks.patch).toHaveBeenCalledWith(
          `/learning/progress/${module}`,
          expect.objectContaining({ version: "current-version" }),
        ),
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "保存进度" })).toBeEnabled(),
      );
    });

    it.each(["success", "failure"] as const)(
      "ignores obsolete GET %s after the new baseline and local edit",
      async (outcome) => {
        const obsolete = deferred<ReturnType<typeof envelope>>();
        const current = deferred<ReturnType<typeof envelope>>();
        mocks.get
          .mockReturnValueOnce(obsolete.promise)
          .mockReturnValueOnce(current.promise);
        mocks.patch.mockResolvedValue(envelope("saved"));
        mount(Page, module, true);
        expect(mocks.get).toHaveBeenCalledTimes(2);
        await act(async () => {
          current.resolve(envelope("current-version"));
        });
        fireEvent.click(
          within(card(first)).getByRole("button", { name: "标记" }),
        );
        mocks.error.mockClear();
        await act(async () => {
          if (outcome === "success")
            obsolete.resolve(
              envelope("obsolete-version", { [`experiment:${second}`]: true }),
            );
          else obsolete.reject({ response: { status: 503 } });
        });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(
          within(card(first)).getByRole("button", { name: "已完成" }),
        ).toBeEnabled();
        expect(
          within(card(second)).getByRole("button", { name: "标记" }),
        ).toBeEnabled();
        expect(mocks.error).not.toHaveBeenCalled();
        switchTab("学习书");
        fireEvent.click(screen.getByRole("button", { name: "保存进度" }));
        await waitFor(() =>
          expect(mocks.patch).toHaveBeenCalledWith(
            `/learning/progress/${module}`,
            expect.objectContaining({
              version: "current-version",
              completedItems: { [`experiment:${first}`]: true },
            }),
          ),
        );
        await waitFor(() =>
          expect(
            screen.getByRole("button", { name: "保存进度" }),
          ).toBeEnabled(),
        );
      },
    );

    it.each(["success", "conflict", "failure"] as const)(
      "ignores late PATCH %s after unmount",
      async (outcome) => {
        const pending = deferred<ReturnType<typeof envelope>>();
        mocks.get.mockResolvedValue(envelope());
        mocks.patch.mockReturnValue(pending.promise);
        const view = mount(Page, module);
        await waitFor(() =>
          expect(
            within(card(first)).getByRole("button", { name: "标记" }),
          ).toBeEnabled(),
        );
        switchTab("学习书");
        fireEvent.click(screen.getByRole("button", { name: "保存进度" }));
        expect(mocks.patch).toHaveBeenCalledTimes(1);
        view.unmount();
        mocks.success.mockClear();
        mocks.error.mockClear();
        await act(async () => {
          if (outcome === "success") pending.resolve(envelope("late-ack"));
          else
            pending.reject({
              response: { status: outcome === "conflict" ? 409 : 503 },
            });
        });
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.error).not.toHaveBeenCalled();
        expect(mocks.get).toHaveBeenCalledTimes(1);
      },
    );
  },
);
