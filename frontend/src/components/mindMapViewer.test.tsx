import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MindMapViewer from "@/features/it-technology/learning/MindMapViewer";

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

  it("挂载时才注入 markmap 运行时（首屏不再引用 d3/markmap）", () => {
    render(<MindMapViewer compact markdown="# Root" />);
    const sources = [...document.querySelectorAll<HTMLScriptElement>("script[data-ws-content-runtime]")]
      .map((node) => node.src);
    // markmap 全局已存在（上面的 beforeEach 已 stub），因此这里不应发请求
    expect(sources.filter((src) => src.includes("/d3@") || src.includes("markmap"))).toEqual([]);
  });
});
