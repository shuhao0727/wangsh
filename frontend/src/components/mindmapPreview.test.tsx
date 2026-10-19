import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import MindmapPreview from "@/pages/MindmapPreview";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams("id=7")],
  };
});

vi.mock("@/features/it-technology/learning/MindMapViewer", () => ({
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

describe("MindmapPreview", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, "open").mockReturnValue(null);
  });

  it("opens a single-root plain-text tree when preview Markdown starts with H1", async () => {
    localStorage.setItem(
      "_wangsh_preview_data",
      JSON.stringify({
        title: "Fallback title",
        content: { markdown: "# <b>Root</b>\n## <i>Child</i>\n" },
      }),
    );

    render(
      <MemoryRouter>
        <MindmapPreview />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /编辑/ }));

    expect(JSON.parse(localStorage.getItem("_wangsh_mindmap_data") || "{}").root).toEqual({
      data: { text: "Root", uid: "n1" },
      children: [{
        data: { text: "Child", uid: "n2" },
        children: [],
      }],
    });
    expect(window.open).toHaveBeenCalledWith(
      "/mindmap-demo/index.html?id=7",
      "_blank",
    );
  });

  it("shows a return action when preview data is missing", () => {
    render(
      <MemoryRouter>
        <MindmapPreview />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "没有可预览的思维导图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回导图广场" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /编辑/ })).not.toBeInTheDocument();
  });
});
