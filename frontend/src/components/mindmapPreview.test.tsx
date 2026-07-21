import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/pages/Admin/ITTechnology/learning/MindMapViewer", () => ({
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

    render(<MindmapPreview />);
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
});
