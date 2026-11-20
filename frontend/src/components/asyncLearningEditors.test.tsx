import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showMessage } from "@/lib/toast";
import MindMapEditor from "@/pages/Admin/ITTechnology/learning/MindMapEditor";
import MindMapEditorLib from "@/pages/Admin/ITTechnology/learning/MindMapEditorLib";
import MindMapViewer from "@/features/it-technology/learning/MindMapViewer";
import TabEditorPage from "@/pages/Admin/ITTechnology/learning/TabEditorPage";
import LearningEditorPage from "@/pages/Admin/ITTechnology/learning/EditorPage";
import AIFullPage from "@/pages/ITTechnology/AIFullPage";
import AgentsFullPage from "@/pages/ITTechnology/AgentsFullPage";
import MLFullPage from "@/pages/ITTechnology/MLFullPage";
import { api } from "@/services";

vi.mock("@/lib/toast", () => ({
  showMessage: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const response = (status: number, data: unknown = null) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(data),
}) as unknown as Response;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const RouteSwitcher = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/admin/it-technology/learning/ml/roadmap")}>
      switch section
    </button>
  );
};

describe("async learning editors", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ["ai", AIFullPage],
    ["agents", AgentsFullPage],
    ["ml", MLFullPage],
  ] as const)("reopens the saved %s chapter in the editor and reader", async (moduleKey, Reader) => {
    const chapter = {
      slug: "round-trip", title: "合成章节", summary: "章节摘要", estimatedMinutes: 15,
      difficulty: "beginner", goals: [], markdown: "教材基础正文", checklist: [],
      experiments: [], glossary: [], references: [],
    };
    const book = {
      moduleKey, title: "合成教材", subtitle: "副标题", description: "课程简介",
      audience: "学生", outcomes: [], chapters: [chapter],
    };
    vi.mocked(fetch).mockResolvedValue(response(200, [{
      section_key: "raw", item_key: "book", enabled: true, content: { book },
    }]));
    let saved = {
      id: 1, module_key: moduleKey, slug: chapter.slug, title: chapter.title,
      summary: chapter.summary, estimated_minutes: 15, difficulty: chapter.difficulty,
      group_name: null, markdown: "历史保存正文", sort_order: 0, updated_at: null,
    };
    const listPath = `/learning/chapters/${moduleKey}`;
    vi.spyOn(api.client, "get").mockImplementation(async (path) => {
      if (path === listPath) return { data: [saved] };
      if (path === `/learning/progress/${moduleKey}`) return { data: { data: {} } };
      throw new Error(`Unexpected GET ${path}`);
    });
    const write = vi.spyOn(api.client, "put").mockImplementation(async (path, body) => {
      if (path !== `${listPath}/${chapter.slug}`) throw new Error(`Unexpected PUT ${path}`);
      saved = { ...saved, markdown: (body as { markdown: string }).markdown };
      return { data: saved };
    });
    const openEditor = () => render(
      <MemoryRouter initialEntries={[`/admin/it-technology/learning/${moduleKey}`]}>
        <Routes>
          <Route path="/admin/it-technology/learning/:moduleKey" element={<LearningEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const editor = openEditor();
    const input = await screen.findByRole("textbox", { name: "章节 Markdown 内容" });
    expect(input).toHaveValue("历史保存正文");
    fireEvent.change(input, { target: { value: "刷新后应读取的正文" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
    editor.unmount();

    const reopened = openEditor();
    expect(await screen.findByRole("textbox", { name: "章节 Markdown 内容" })).toHaveValue("刷新后应读取的正文");
    reopened.unmount();
    render(
      <MemoryRouter initialEntries={[`/it-technology/${moduleKey}?tab=book`]}>
        <Reader />
      </MemoryRouter>,
    );
    expect(await screen.findByText("刷新后应读取的正文")).toBeInTheDocument();
    expect(screen.queryByText("教材基础正文")).not.toBeInTheDocument();
  });

  it("does not open the tab editor when the initial fetch returns 500", async () => {
    vi.mocked(fetch).mockResolvedValue(response(500));

    render(
      <MemoryRouter initialEntries={["/admin/it-technology/learning/ml/tools"]}>
        <Routes>
          <Route
            path="/admin/it-technology/learning/:moduleKey/:section"
            element={<TabEditorPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(showMessage.error).toHaveBeenCalled());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(await screen.findByText(/加载失败/)).toBeInTheDocument();
  });

  it("does not open the module mindmap editor when the initial fetch returns 404", async () => {
    vi.mocked(fetch).mockResolvedValue(response(404));

    render(
      <MemoryRouter initialEntries={["/admin/it-technology/mindmap/ml"]}>
        <Routes>
          <Route
            path="/admin/it-technology/mindmap/:moduleKey"
            element={<MindMapEditor />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(showMessage.error).toHaveBeenCalled());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(await screen.findByText(/加载失败/)).toBeInTheDocument();
  });

  it("uses numeric SVG dimensions in the mindmap editor preview", async () => {
    const createMarkmap = vi.fn().mockReturnValue({ destroy: vi.fn() });
    Object.assign(window, {
      markmap: {
        Transformer: class {
          transform() {
            return { root: { content: "root" } };
          }
        },
        Markmap: { create: createMarkmap },
      },
    });

    render(
      <MemoryRouter>
        <MindMapEditor
          mindmapId={1}
          initialTitle="Root"
          initialMarkdown="# Root"
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "预览" }));

    await waitFor(() => expect(createMarkmap).toHaveBeenCalledOnce());
    const svg = createMarkmap.mock.calls[0][0] as SVGSVGElement;
    expect(svg.getAttribute("width")).toMatch(/^\d+$/);
    expect(svg.getAttribute("height")).toMatch(/^\d+$/);
    expect(svg.style.width).toBe("100%");
    expect(svg.style.height).toBe("100%");
  });

  it("renders compact mindmap cards without a D3 transition", async () => {
    const setData = vi.fn().mockResolvedValue(undefined);
    const fit = vi.fn().mockResolvedValue(undefined);
    const createMarkmap = vi.fn().mockReturnValue({
      destroy: vi.fn(),
      fit,
      setData,
      state: { rect: { x1: 0, x2: 100, y1: 0, y2: 50 } },
    });
    vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 160,
      height: 160,
      left: 0,
      right: 300,
      top: 0,
      width: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    Object.assign(window, {
      markmap: {
        Transformer: class {
          transform() {
            return { root: { content: "root" } };
          }
        },
        Markmap: { create: createMarkmap },
      },
    });

    render(<MindMapViewer markdown="# Root" compact />);

    await waitFor(() => expect(createMarkmap).toHaveBeenCalledOnce());
    expect(createMarkmap.mock.calls[0]).toEqual([
      expect.any(SVGSVGElement),
      { autoFit: false, duration: 0 },
    ]);
    expect(setData).toHaveBeenCalledWith({ content: "root" });
    await waitFor(() => expect(fit).toHaveBeenCalledOnce());
    const svg = createMarkmap.mock.calls[0][0] as SVGSVGElement;
    expect(svg.getAttribute("height")).toBe("160");
  });

  it("round-trips the embedded mindmap without duplicate roots or rich-text HTML", async () => {
    vi.mocked(fetch).mockResolvedValue(response(200));

    render(
      <MindMapEditorLib
        mindmapId={7}
        initialTitle="课堂导图"
        initialMarkdown="# 课堂导图"
      />,
    );

    const initialData = JSON.parse(localStorage.getItem("_wangsh_mindmap_data") || "{}");
    expect(initialData.root).toEqual({
      data: { text: "课堂导图", uid: "n1" },
      children: [],
    });

    const iframe = screen.getByTitle("思维导图编辑器");
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      value: {
        takeOverAppMethods: {
          getMindMapData: () => ({
            root: {
              data: { text: "<p>课堂中心主题</p>" },
              children: [
                { data: { text: "<strong>最新节点</strong>" }, children: [] },
              ],
            },
          }),
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/learning/mindmaps/7");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({
      title: "课堂导图",
      content: {
        markdown: "# 课堂中心主题\n## 最新节点\n",
      },
    });
  });

  it("does not report a successful deletion when the DELETE request returns 500", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(200, [{
        id: 1,
        section_key: "tools",
        item_key: "demo",
        title: "Demo",
        content: { name: "Demo" },
        sort_order: 0,
      }]))
      .mockResolvedValueOnce(response(500));

    const { container } = render(
      <MemoryRouter initialEntries={["/admin/it-technology/learning/ml/tools"]}>
        <Routes>
          <Route
            path="/admin/it-technology/learning/:moduleKey/:section"
            element={<TabEditorPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Demo");
    const deleteButton = [...container.querySelectorAll("button")]
      .find((button) => button.querySelector(".lucide-trash-2"));
    expect(deleteButton).toBeDefined();
    fireEvent.click(deleteButton!);

    await waitFor(() => expect(showMessage.error).toHaveBeenCalled());
    expect(showMessage.success).not.toHaveBeenCalledWith("已删除");
  });

  it("does not reload the old section after a save completes following a route switch", async () => {
    const save = deferred<Response>();
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "PUT") return save.promise;
      if (url.includes("?section=roadmap")) return Promise.resolve(response(200, []));
      return Promise.resolve(response(200, [{
        id: 1,
        section_key: "tools",
        item_key: "demo",
        title: "Demo",
        content: { name: "Demo" },
        sort_order: 0,
      }]));
    });

    render(
      <MemoryRouter initialEntries={["/admin/it-technology/learning/ml/tools"]}>
        <RouteSwitcher />
        <Routes>
          <Route
            path="/admin/it-technology/learning/:moduleKey/:section"
            element={<TabEditorPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Demo");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    fireEvent.click(screen.getByRole("button", { name: "switch section" }));
    save.resolve(response(200));

    await waitFor(() => expect(showMessage.success).toHaveBeenCalledWith("保存成功"));
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input).includes("/api/v1/learning/content/ml")).length)
      .toBe(3);
  });
});
