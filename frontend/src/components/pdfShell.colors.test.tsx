import React, { createRef } from "react";
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseColor, type ParsedColor } from "@/lib/cssTokens";
import PdfCanvasVirtualViewer, { type PdfCanvasVirtualViewerHandle } from "./Pdf/PdfCanvasVirtualViewer";

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: "" },
}));
const logger = vi.hoisted(() => ({ debug: vi.fn(), error: vi.fn() }));
vi.mock("pdfjs-dist/build/pdf", () => pdfjs);
vi.mock("@services/logger", () => ({ logger }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

const observers: Array<{
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  options?: IntersectionObserverInit;
}> = [];

const fixture = (numPages = 2) => {
  const page = {
    getViewport: vi.fn(({ scale }: { scale: number }) => ({ width: 100 * scale, height: 200 * scale })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
  };
  const pdf = { numPages, getPage: vi.fn().mockResolvedValue(page) };
  return { page, pdf };
};

beforeEach(() => {
  vi.clearAllMocks();
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      observers.push({ callback, observe: this.observe, disconnect: this.disconnect, options });
    }
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("PDF viewer shell states and content protection", () => {
  it("leaves a missing preview to the parent and never starts a PDF worker", () => {
    const { container } = render(<PdfCanvasVirtualViewer data={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });

  it("shows named, visible loading and zero-page states without inventing a canvas", async () => {
    const pending = deferred<ReturnType<typeof fixture>["pdf"]>();
    pdfjs.getDocument.mockReturnValue({ promise: pending.promise });
    const { container } = render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} />);
    const loading = await screen.findByRole("status", { name: "正在加载 PDF 页面…" });
    expect(loading).toHaveClass("text-module-shell-muted");
    expect(loading.querySelector("span")).not.toHaveClass("sr-only");
    expect(screen.getByRole("region", { name: "PDF 页面" })).toHaveAttribute("aria-busy", "true");
    await act(async () => pending.resolve(fixture(0).pdf));
    expect(await screen.findByRole("status", { name: "暂无可预览页面" })).toHaveTextContent("暂无可预览页面");
    expect(screen.getByRole("region", { name: "PDF 页面" })).toHaveAttribute("aria-busy", "false");
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("uses module-shell surfaces/focus while passing the PDF bytes and render options unchanged", async () => {
    const { page, pdf } = fixture();
    const data = new Uint8Array([37, 80, 68, 70]);
    pdfjs.getDocument.mockReturnValue({ promise: Promise.resolve(pdf) });
    const onLoaded = vi.fn();
    const onHeight = vi.fn();
    const { container } = render(
      <PdfCanvasVirtualViewer data={data} scale={1.5} onPdfLoaded={onLoaded} onFirstPageWrapHeight={onHeight} />,
    );
    const firstPage = await screen.findByRole("group", { name: "第 1 页" });
    const shell = screen.getByRole("region", { name: "PDF 页面" });
    expect(shell).toHaveClass("bg-module-shell-surface-2", "text-module-shell-text", "focus-visible:ring-module-shell-focus");
    expect(shell).toHaveAttribute("tabindex", "0");
    expect(firstPage.style.background).toBe("var(--ws-color-module-shell-surface-2)");
    expect(firstPage.style.padding).toBe("14px");
    expect(firstPage.style.maxWidth).toBe("980px");
    expect(pdfjs.getDocument).toHaveBeenCalledWith({ data: expect.any(Uint8Array) });
    expect(pdfjs.getDocument.mock.calls[0][0].data).not.toBe(data);
    expect(pdfjs.getDocument.mock.calls[0][0].data).toEqual(data);
    expect(onLoaded).toHaveBeenCalledWith(pdf);
    expect(onHeight).toHaveBeenCalledWith(328);
    const observer = observers.at(-1)!;
    expect(observer.observe).toHaveBeenCalledTimes(2);
    await act(async () => observer.callback([
      { isIntersecting: true, target: firstPage } as unknown as IntersectionObserverEntry,
    ], {} as IntersectionObserver));
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    const options = ((page.render.mock.calls as unknown[][])[0]?.[0] ?? {}) as Record<string, unknown>;
    expect(Object.keys(options).sort()).toEqual(["canvasContext", "viewport"]);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(150);
    expect(canvas.height).toBe(300);
    expect(canvas.style.background).toBe("");
    expect(canvas.style.color).toBe("");
    expect(canvas.style.filter).toBe("");
    expect(canvas.style.opacity).toBe("");
    expect(data).toEqual(new Uint8Array([37, 80, 68, 70]));
  });

  it("shows PDF loading errors with text and an alert, then clears the error on a new document", async () => {
    const error = new Error("Invalid PDF fixture");
    pdfjs.getDocument.mockReturnValueOnce({ promise: Promise.reject(error) });
    const { rerender } = render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("bg-error-soft", "text-error-text");
    expect(alert).toHaveTextContent("PDF 页面加载失败");
    expect(alert).toHaveTextContent("请重新加载预览，或检查 PDF 文件。");
    expect(logger.error).toHaveBeenCalledWith("Failed to load PDF:", error);
    pdfjs.getDocument.mockReturnValueOnce({ promise: Promise.resolve(fixture(1).pdf) });
    rerender(<PdfCanvasVirtualViewer data={new Uint8Array([2])} />);
    await screen.findByRole("group", { name: "第 1 页" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ignores an obsolete load and its error instead of replacing a newer document", async () => {
    const oldLoad = deferred<ReturnType<typeof fixture>["pdf"]>();
    const newPdf = fixture(1).pdf;
    pdfjs.getDocument.mockReturnValueOnce({ promise: oldLoad.promise });
    const onLoaded = vi.fn();
    const { rerender } = render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} onPdfLoaded={onLoaded} />);
    await waitFor(() => expect(pdfjs.getDocument).toHaveBeenCalledTimes(1));
    pdfjs.getDocument.mockReturnValueOnce({ promise: Promise.resolve(newPdf) });
    rerender(<PdfCanvasVirtualViewer data={new Uint8Array([2])} onPdfLoaded={onLoaded} />);
    await screen.findByRole("group", { name: "第 1 页" });
    await act(async () => oldLoad.reject(new Error("obsolete fixture")));
    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onLoaded).toHaveBeenCalledWith(newPdf);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("invalidates a pending document when the parent clears preview data", async () => {
    const pending = deferred<ReturnType<typeof fixture>["pdf"]>();
    pdfjs.getDocument.mockReturnValue({ promise: pending.promise });
    const onLoaded = vi.fn();
    const { container, rerender } = render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} onPdfLoaded={onLoaded} />);
    await waitFor(() => expect(pdfjs.getDocument).toHaveBeenCalledTimes(1));
    rerender(<PdfCanvasVirtualViewer data={null} onPdfLoaded={onLoaded} />);
    await act(async () => pending.resolve(fixture().pdf));
    expect(container).toBeEmptyDOMElement();
    expect(onLoaded).not.toHaveBeenCalled();
    expect(pdfjs.getDocument).toHaveBeenCalledTimes(1);
  });

  it("preserves directory page navigation and disconnects the visibility observer on unmount", async () => {
    pdfjs.getDocument.mockReturnValue({ promise: Promise.resolve(fixture().pdf) });
    const handle = createRef<PdfCanvasVirtualViewerHandle>();
    const root = document.createElement("div");
    const scrollTo = vi.fn();
    root.scrollTo = scrollTo;
    const { unmount } = render(<PdfCanvasVirtualViewer ref={handle} data={new Uint8Array([1])} rootRef={{ current: root }} />);
    const lastPage = await screen.findByRole("group", { name: "第 2 页" });
    root.getBoundingClientRect = vi.fn(() => ({ top: 100 }) as DOMRect);
    lastPage.getBoundingClientRect = vi.fn(() => ({ top: 223 }) as DOMRect);
    act(() => handle.current!.scrollToPage(99));
    expect(scrollTo).toHaveBeenCalledWith({ top: 115, behavior: "smooth" });
    const observer = observers.at(-1)!;
    expect(observer.options).toEqual({ root, rootMargin: "800px 0px", threshold: 0.01 });
    unmount();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("copies bytes before PDF.js worker transfer so scale reloads never reuse a detached buffer", async () => {
    const workerPayloads: number[][] = [];
    pdfjs.getDocument.mockImplementation(({ data: workerData }: { data: Uint8Array }) => {
      workerPayloads.push(Array.from(workerData));
      structuredClone(workerData.buffer, { transfer: [workerData.buffer] });
      return { promise: Promise.resolve(fixture(1).pdf) };
    });
    const data = new Uint8Array([1, 2, 3]);
    const { rerender } = render(<PdfCanvasVirtualViewer data={data} scale={1} />);
    await screen.findByRole("group", { name: "第 1 页" });
    rerender(<PdfCanvasVirtualViewer data={data} scale={2} />);
    await waitFor(() => expect(pdfjs.getDocument).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("group", { name: "第 1 页" }).querySelector("canvas")!.parentElement).toHaveStyle({ maxWidth: "200px", aspectRatio: "200 / 400" }));
    expect(screen.getByRole("group", { name: "第 1 页" }).querySelector("canvas")).toHaveStyle({ width: "100%", height: "100%" });
    expect(workerPayloads).toEqual([[1, 2, 3], [1, 2, 3]]);
    expect(data).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("existing PDF.js worker configuration regression (no worker refactor)", () => {
  it.each([
    [false, "/node_modules/pdfjs-dist/build/pdf.worker.js"],
    [true, "/assets/pdf.worker.js"],
  ])("configures the %s worker path once and preserves getPdfJs identity", async (production, workerSrc) => {
    vi.resetModules();
    vi.stubEnv("PROD", production);
    const setWorkerSrc = vi.fn();
    let current = "";
    Object.defineProperty(pdfjs.GlobalWorkerOptions, "workerSrc", {
      configurable: true,
      get: () => current,
      set: (value: string) => { current = value; setWorkerSrc(value); },
    });
    const { configurePdfJs, getPdfJs } = await import("@/utils/pdfInit");
    await configurePdfJs();
    await configurePdfJs();
    const result = await getPdfJs();
    expect(setWorkerSrc).toHaveBeenCalledExactlyOnceWith(workerSrc);
    expect(result.getDocument).toBe(pdfjs.getDocument);
    expect(result.GlobalWorkerOptions).toBe(pdfjs.GlobalWorkerOptions);
    expect(logger.debug).toHaveBeenCalledExactlyOnceWith("PDF.js configured with workerSrc:", workerSrc);
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });

  it("propagates configuration failure and permits a later retry", async () => {
    vi.resetModules();
    vi.stubEnv("PROD", false);
    const error = new Error("worker configuration fixture");
    const setter = vi.fn().mockImplementationOnce(() => { throw error; });
    Object.defineProperty(pdfjs.GlobalWorkerOptions, "workerSrc", {
      configurable: true,
      get: () => "/node_modules/pdfjs-dist/build/pdf.worker.js",
      set: setter,
    });
    const { configurePdfJs } = await import("@/utils/pdfInit");
    await expect(configurePdfJs()).rejects.toBe(error);
    expect(logger.error).toHaveBeenCalledWith("Failed to configure PDF.js:", error);
    await expect(configurePdfJs()).resolves.toBeUndefined();
    expect(setter).toHaveBeenCalledTimes(2);
  });
});

describe("Informatics CSS shell contract", () => {
  const src = path.resolve(process.cwd(), "src");
  const css = postcss.parse(fs.readFileSync(path.join(src, "pages/Informatics/Informatics.css"), "utf8"));
  const tokens = new Map<string, string>();
  postcss.parse(fs.readFileSync(path.join(src, "styles/index.css"), "utf8")).walkDecls((decl) => {
    if (decl.prop.startsWith("--ws-")) tokens.set(decl.prop, decl.value);
  });
  const value = (selector: string, property: string) => {
    let found: string | undefined;
    css.walkRules(selector, (rule) => rule.walkDecls(property, (decl) => { found = decl.value; }));
    return found;
  };

  it("uses declared shell colors for reader surfaces, directory hover/selected, and keyboard focus", () => {
    expect(value(".informatics-card", "background")).toBe("var(--ws-color-module-shell-surface)");
    expect(value(".informatics-typst-viewer", "background")).toBe("var(--ws-color-module-shell-surface-2)");
    expect(value(".informatics-tree-row:hover", "background-color")).toBe("var(--ws-color-module-shell-hover)");
    expect(value(".informatics-tree-row-selected", "background-color")).toBe("var(--ws-color-module-shell-selected)");
    expect(value(".informatics-tree-row-selected", "font-weight")).toBe("600");
    expect(value(".informatics-tree-row:focus-visible", "box-shadow")).toContain("var(--ws-color-module-shell-focus)");
    expect(value(".informatics-typst-viewer:focus-visible", "outline")).toBe("2px solid var(--ws-color-module-shell-focus)");
    css.walkDecls((decl) => {
      for (const match of decl.value.matchAll(/var\((--ws-[\w-]+)/g)) expect(tokens.has(match[1]), match[1]).toBe(true);
      expect(decl.prop).not.toMatch(/^(filter|opacity)$/);
      expect(decl.value).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i);
    });
  });

  it("keeps shell text and composed error/info/selected states readable on both light surfaces", () => {
    const tokenColor = (name: string, depth = 0): ParsedColor => {
      if (depth > 12) throw new Error(`Token alias cycle: ${name}`);
      const raw = tokens.get(name);
      if (!raw) throw new Error(`Undefined token: ${name}`);
      const alias = /^var\((--ws-[\w-]+)\)$/.exec(raw);
      if (alias) return tokenColor(alias[1], depth + 1);
      const parsed = parseColor(raw);
      if (!parsed) throw new Error(`Unparseable color: ${raw}`);
      return parsed;
    };
    const compose = (foreground: ParsedColor, background: ParsedColor): ParsedColor => ({
      red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
      green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
      blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
      alpha: 1,
    });
    const luminance = (color: ParsedColor) => {
      const linear = [color.red, color.green, color.blue].map((channel) => {
        const n = channel / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const contrast = (foreground: ParsedColor, background: ParsedColor) => {
      const [hi, lo] = [luminance(compose(foreground, background)), luminance(background)].sort((a, b) => b - a);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const surface of ["--ws-color-module-shell-surface", "--ws-color-module-shell-surface-2"]) {
      const background = tokenColor(surface);
      for (const foreground of ["--ws-color-module-shell-text", "--ws-color-module-shell-muted"]) {
        expect(contrast(tokenColor(foreground), background), `${foreground} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const [foreground, overlay] of [
        ["--ws-color-error-text", "--ws-color-error-soft"],
        ["--ws-color-info-text", "--ws-color-info-soft"],
        ["--ws-color-brand-accent-text", "--ws-color-module-shell-selected"],
        ["--ws-color-primary-text", "--ws-color-module-shell-hover"],
      ]) {
        expect(contrast(tokenColor(foreground), compose(tokenColor(overlay), background)), `${foreground} on ${overlay}/${surface}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(tokenColor("--ws-color-module-shell-focus"), background)).toBeGreaterThanOrEqual(3);
    }
  });

  it("does not target canvas content or introduce PDF selection/search/annotation themes", () => {
    css.walkRules((rule) => expect(rule.selector).not.toMatch(/canvas|textLayer|annotationLayer/));
    const viewer = fs.readFileSync(path.join(src, "components/Pdf/PdfCanvasVirtualViewer.tsx"), "utf8");
    expect(viewer).not.toMatch(/canvas\.style\.(?:background|color|filter|opacity)|(?:fillStyle|strokeStyle|globalAlpha|fillRect)\s*[=(]/);
    expect(viewer).not.toMatch(/--ws-color-pdf-(?:selection|search|annotation)/);
    // Lifecycle tracking now retains the task handle; the behavioral test above checks the options.
    expect(viewer).toContain("page.render({ canvasContext: context, viewport })");
  });
});
