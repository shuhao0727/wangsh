import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MindMapViewer from "@/pages/Admin/ITTechnology/learning/MindMapViewer";

const createMarkmap = vi.fn();

describe("MindMapViewer", () => {
  beforeEach(() => {
    createMarkmap.mockReset();
    createMarkmap.mockReturnValue({ destroy: vi.fn() });
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
  });

  it("uses numeric SVG dimensions so D3 can resolve SVGLength values", async () => {
    render(<MindMapViewer compact markdown="# Root" />);

    await waitFor(() => expect(createMarkmap).toHaveBeenCalledOnce());
    const svg = createMarkmap.mock.calls[0][0] as SVGSVGElement;

    expect(svg.getAttribute("width")).toMatch(/^\d+$/);
    expect(svg.getAttribute("height")).toMatch(/^\d+$/);
    expect(svg.style.width).toBe("100%");
    expect(svg.style.height).toBe("100%");
  });
});
