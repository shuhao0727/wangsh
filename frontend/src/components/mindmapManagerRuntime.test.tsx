import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MindMapManager from "@/pages/Admin/ITTechnology/learning/MindMapManager";

const runtimeAvailable = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/mindmapRuntime", () => ({
  isMindmapEditorRuntimeAvailable: runtimeAvailable,
  MINDMAP_EDITOR_UNAVAILABLE_MESSAGE:
    "生产环境暂不提供旧版思维导图编辑器，已有导图仍可预览。",
}));

vi.mock("@/lib/toast", () => ({
  showMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/pages/Admin/ITTechnology/learning/MindMapViewer", () => ({
  default: ({ markdown }: { markdown: string }) => (
    <div data-testid="mindmap-viewer">{markdown}</div>
  ),
}));

const response = (status: number, data: unknown = null) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
  }) as unknown as Response;

describe("MindMapManager runtime boundary", () => {
  beforeEach(() => {
    runtimeAvailable.mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("blocks production creation before sending a POST request", async () => {
    const { showMessage } = await import("@/lib/toast");
    runtimeAvailable.mockReturnValue(false);
    vi.mocked(fetch).mockResolvedValue(response(200, []));

    render(<MindMapManager />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: /新建导图/ }));

    expect(showMessage.warning).toHaveBeenCalledWith(
      "生产环境暂不提供旧版思维导图编辑器，已有导图仍可预览。",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens existing production records as a read-only preview without an iframe", async () => {
    runtimeAvailable.mockReturnValue(false);
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        response(200, [
          {
            id: 7,
            title: "生产导图",
            content: { markdown: "# 生产导图\n## 节点\n" },
            owner_id: 1,
            created_at: "2026-07-22",
            updated_at: "2026-07-22",
            module_key: "general",
          },
        ]),
      )
      .mockResolvedValueOnce(response(200, []));

    render(<MindMapManager />);

    await screen.findByText("生产导图");
    fireEvent.click(screen.getByTitle("预览"));

    expect(
      screen.getByText(
        "生产环境暂不提供旧版思维导图编辑器，已有导图仍可预览。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTitle("思维导图编辑器")).not.toBeInTheDocument();
    expect(screen.getByTestId("mindmap-viewer")).toHaveTextContent(
      "# 生产导图 ## 节点",
    );
  });
});
