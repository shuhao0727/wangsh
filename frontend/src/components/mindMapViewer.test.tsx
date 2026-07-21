import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MindMapViewer from "@/pages/Admin/ITTechnology/learning/MindMapViewer";

const createMarkmap = vi.fn();
const setData = vi.fn();
const fit = vi.fn();

describe("MindMapViewer", () => {
  beforeEach(() => {
    createMarkmap.mockReset();
    setData.mockReset();
    setData.mockResolvedValue(undefined);
    fit.mockReset();
    fit.mockResolvedValue(undefined);
    createMarkmap.mockReturnValue({
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
  });

  it("uses numeric SVG dimensions so D3 can resolve SVGLength values", async () => {
    render(<MindMapViewer compact markdown="# Root" />);

    await waitFor(() => expect(createMarkmap).toHaveBeenCalledOnce());
    const svg = createMarkmap.mock.calls[0][0] as SVGSVGElement;

    expect(createMarkmap.mock.calls[0][2]).toBeUndefined();
    expect(setData).toHaveBeenCalledWith({ content: "root" });
    await waitFor(() => expect(fit).toHaveBeenCalledOnce());
    expect(svg.getAttribute("width")).toMatch(/^\d+$/);
    expect(svg.getAttribute("height")).toMatch(/^\d+$/);
    expect(svg.style.width).toBe("100%");
    expect(svg.style.height).toBe("100%");
  });
});
