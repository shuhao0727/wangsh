import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MindmapGallery from "@/pages/MindmapGallery";

vi.mock("@/lib/toast", () => ({
  showMessage: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/pages/Admin/ITTechnology/learning/MindMapViewer", () => ({
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

const response = (status: number, data: unknown = null) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(data),
}) as unknown as Response;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

describe("MindmapGallery async loading", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("probes the cookie-backed personal session without a readable token", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(response(401));

    render(<MindmapGallery />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/learning/mindmaps",
      expect.any(Object),
    );
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/my"))).toBe(true);
  });

  it("ignores an older public request that resolves after a focus refresh", async () => {
    const firstPublic = deferred<Response>();
    const secondPublic = deferred<Response>();
    let publicCalls = 0;
    vi.mocked(fetch).mockImplementation((url) => {
      if (String(url).endsWith("/my")) return Promise.resolve(response(401));
      publicCalls += 1;
      return publicCalls === 1 ? firstPublic.promise : secondPublic.promise;
    });

    render(<MindmapGallery />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));

    secondPublic.resolve(response(200, [{
      id: 2,
      title: "最新导图",
      content: { markdown: "# 最新导图" },
      updated_at: "2026-07-11",
    }]));
    await screen.findByText("最新导图");

    firstPublic.resolve(response(200, [{
      id: 1,
      title: "旧导图",
      content: { markdown: "# 旧导图" },
      updated_at: "2026-07-10",
    }]));

    await waitFor(() => expect(screen.queryByText("旧导图")).not.toBeInTheDocument());
    expect(screen.getByText("最新导图")).toBeInTheDocument();
  });

  it("shows a personal-load error instead of claiming the user is logged out", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(response(500));

    render(<MindmapGallery />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("tab", { name: /我的导图/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load personal mindmaps: 500",
    );
    expect(screen.queryByText("登录后查看我的导图")).not.toBeInTheDocument();
  });

  it("opens a single-root tree when a stored mindmap already starts with an H1", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(200, [{
        id: 3,
        title: "课堂导图",
        content: { markdown: "# 课堂导图\n## 最新节点\n" },
        updated_at: "2026-07-19",
      }]))
      .mockResolvedValueOnce(response(401));

    render(<MindmapGallery />);

    await screen.findByText("课堂导图");
    fireEvent.click(screen.getByTitle("编辑（新标签页）"));

    expect(JSON.parse(localStorage.getItem("_wangsh_mindmap_data") || "{}").root).toEqual({
      data: { text: "课堂导图", uid: "n1" },
      children: [{
        data: { text: "最新节点", uid: "n2" },
        children: [],
      }],
    });
    expect(open).toHaveBeenCalledWith("/mindmap-demo/index.html?id=3", "_blank");
  });
});
