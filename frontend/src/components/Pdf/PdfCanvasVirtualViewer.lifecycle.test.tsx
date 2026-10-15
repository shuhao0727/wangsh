import React, { StrictMode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PdfCanvasVirtualViewer, { type PdfCanvasVirtualViewerHandle } from "./PdfCanvasVirtualViewer";

const mocks = vi.hoisted(() => ({ getPdfJs: vi.fn(), getDocument: vi.fn(), error: vi.fn() }));
vi.mock("@/utils/pdfInit", () => ({ getPdfJs: mocks.getPdfJs }));
vi.mock("@services/logger", () => ({ logger: { error: mocks.error } }));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const observers: Array<{ callback: IntersectionObserverCallback; targets: Set<Element> }> = [];
const fixture = (numPages = 1) => {
  const rendering = deferred<void>();
  const task = { promise: rendering.promise, cancel: vi.fn(() => rendering.reject({ name: "RenderingCancelledException" })) };
  const page = { getViewport: vi.fn(() => ({ width: 100, height: 200 })), render: vi.fn(() => task) };
  const pdf = { numPages, getPage: vi.fn().mockResolvedValue(page), destroy: vi.fn().mockResolvedValue(undefined) };
  const loading = { promise: Promise.resolve(pdf), destroy: vi.fn().mockResolvedValue(undefined) };
  return { pdf, page, loading, task, rendering };
};
const intersect = async (...elements: HTMLElement[]) => {
  await waitFor(() => expect(observers.some(observer => elements.every(element => observer.targets.has(element)))).toBe(true));
  const observer = [...observers].reverse().find(candidate => elements.every(element => candidate.targets.has(element)))!;
  await act(async () => observer.callback(elements.map((target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry), {} as IntersectionObserver));
};
beforeEach(() => {
  vi.resetAllMocks();
  observers.length = 0;
  mocks.getPdfJs.mockResolvedValue({ getDocument: mocks.getDocument });
  vi.stubGlobal("IntersectionObserver", class {
    private readonly record: (typeof observers)[number];
    constructor(callback: IntersectionObserverCallback) {
      this.record = { callback, targets: new Set() };
      observers.push(this.record);
    }
    observe(target: Element) { this.record.targets.add(target); }
    disconnect() { this.record.targets.clear(); }
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("PDF lifecycle cancellation and generation", () => {
  it("does not start a worker after unmount while PDF.js is importing", async () => {
    const imported = deferred<any>();
    mocks.getPdfJs.mockReturnValue(imported.promise);
    const { unmount } = render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} />);
    unmount();
    await act(async () => imported.resolve({ getDocument: mocks.getDocument }));
    expect(mocks.getDocument).not.toHaveBeenCalled();
  });

  it("destroys the superseded loading task and disposes a document that resolves late", async () => {
    const old = fixture(); const next = fixture(); const pending = deferred<typeof old.pdf>();
    old.loading.promise = pending.promise;
    mocks.getDocument.mockReturnValueOnce(old.loading).mockReturnValueOnce(next.loading);
    const loaded = vi.fn();
    const { rerender, unmount } = render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} onPdfLoaded={loaded} />);
    await waitFor(() => expect(mocks.getDocument).toHaveBeenCalledTimes(1));
    rerender(<PdfCanvasVirtualViewer data={new Uint8Array([2])} onPdfLoaded={loaded} />);
    await screen.findByRole("group", { name: "第 1 页" });
    expect(old.loading.destroy).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(old.pdf));
    expect(old.pdf.destroy).toHaveBeenCalledTimes(1);
    expect(loaded).toHaveBeenCalledExactlyOnceWith(next.pdf);
    unmount();
    expect(next.pdf.destroy).toHaveBeenCalledTimes(1);
  });

  it("cancels active render, drains queued pages, and does not let the old queue hold a new document", async () => {
    const old = fixture(3); const next = fixture();
    mocks.getDocument.mockReturnValueOnce(old.loading).mockReturnValueOnce(next.loading);
    const { rerender } = render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} maxConcurrentRenders={1} />);
    const first = await screen.findByRole("group", { name: "第 1 页" });
    await intersect(first, screen.getByRole("group", { name: "第 2 页" }), screen.getByRole("group", { name: "第 3 页" }));
    expect(old.page.render).toHaveBeenCalledTimes(1);
    rerender(<PdfCanvasVirtualViewer data={new Uint8Array([2])} maxConcurrentRenders={1} />);
    const nextFirst = await screen.findByRole("group", { name: "第 1 页" });
    await intersect(nextFirst);
    expect(old.task.cancel).toHaveBeenCalledTimes(1);
    expect(old.pdf.destroy).toHaveBeenCalledTimes(1);
    expect(old.page.render).toHaveBeenCalledTimes(1);
    expect(next.page.render).toHaveBeenCalledTimes(1);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("checks generation after getPage before touching a canvas or creating a render task", async () => {
    const old = fixture(); const next = fixture(); const pendingPage = deferred<typeof old.page>();
    old.pdf.getPage.mockResolvedValueOnce(old.page).mockReturnValueOnce(pendingPage.promise);
    mocks.getDocument.mockReturnValueOnce(old.loading).mockReturnValueOnce(next.loading);
    const { rerender } = render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} />);
    await intersect(await screen.findByRole("group", { name: "第 1 页" }));
    rerender(<PdfCanvasVirtualViewer data={new Uint8Array([2])} />);
    await screen.findByRole("group", { name: "第 1 页" });
    await act(async () => pendingPage.resolve(old.page));
    expect(old.page.render).not.toHaveBeenCalled();
  });

  it("shows render rejection as an error and recovers when another document opens", async () => {
    const old = fixture(); const next = fixture();
    old.page.render.mockImplementationOnce(() => { throw new Error("worker render failed"); });
    mocks.getDocument.mockReturnValueOnce(old.loading).mockReturnValueOnce(next.loading);
    const { rerender } = render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} />);
    await intersect(await screen.findByRole("group", { name: "第 1 页" }));
    expect(screen.getByRole("alert")).toHaveTextContent("PDF 页面渲染失败");
    rerender(<PdfCanvasVirtualViewer data={new Uint8Array([2])} />);
    await screen.findByRole("group", { name: "第 1 页" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("settles task promise rejection without an unhandled rejection", async () => {
    const f = fixture(); mocks.getDocument.mockReturnValue(f.loading);
    render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} />);
    await intersect(await screen.findByRole("group", { name: "第 1 页" }));
    await act(async () => f.rendering.reject(new Error("render task rejected")));
    expect(screen.getByRole("alert")).toHaveTextContent("PDF 页面渲染失败");
    expect(mocks.error).toHaveBeenCalledWith("Failed to render PDF page:", expect.any(Error));
  });

  it("reports metadata page failure and destroys the unusable document", async () => {
    const f = fixture(); f.pdf.getPage.mockRejectedValue(new Error("broken page tree"));
    mocks.getDocument.mockReturnValue(f.loading);
    render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("PDF 页面加载失败");
    expect(f.pdf.destroy).toHaveBeenCalledTimes(1);
  });

  it("does not reload for a callback identity change, and scale reload destroys the prior document", async () => {
    const old = fixture(); const next = fixture(); const bytes = new Uint8Array([1]);
    mocks.getDocument.mockReturnValueOnce(old.loading).mockReturnValueOnce(next.loading);
    const { rerender, unmount } = render(<PdfCanvasVirtualViewer data={bytes} scale={1} onPdfLoaded={() => {}} />);
    await screen.findByRole("group", { name: "第 1 页" });
    rerender(<PdfCanvasVirtualViewer data={bytes} scale={1} onPdfLoaded={() => {}} />);
    expect(mocks.getDocument).toHaveBeenCalledTimes(1);
    rerender(<PdfCanvasVirtualViewer data={bytes} scale={2} />);
    await waitFor(() => expect(mocks.getDocument).toHaveBeenCalledTimes(2));
    expect(old.pdf.destroy).toHaveBeenCalledTimes(1);
    unmount(); expect(next.pdf.destroy).toHaveBeenCalledTimes(1);
    expect(bytes).toEqual(new Uint8Array([1]));
  });

  it("cleans up StrictMode's abandoned effect and clearing a preview", async () => {
    const first = fixture(); const second = fixture();
    mocks.getDocument.mockReturnValueOnce(first.loading).mockReturnValueOnce(second.loading);
    const { rerender } = render(<StrictMode><PdfCanvasVirtualViewer data={new Uint8Array([1])} /></StrictMode>);
    await screen.findByRole("group", { name: "第 1 页" });
    expect(mocks.getDocument).toHaveBeenCalledTimes(1);
    rerender(<StrictMode><PdfCanvasVirtualViewer data={null} /></StrictMode>);
    expect(first.loading.destroy).not.toHaveBeenCalled();
    expect(first.pdf.destroy).toHaveBeenCalledTimes(1);
    expect(second.pdf.destroy).not.toHaveBeenCalled();
  });
  it("anchors directory scrolling to the reader viewport, not the page offset parent", async () => {
    const f = fixture(); mocks.getDocument.mockReturnValue(f.loading);
    const root = document.createElement("div");
    root.scrollTo = vi.fn();
    Object.defineProperty(root, "scrollTop", { value: 400, writable: true });
    Object.defineProperty(root, "clientTop", { value: 2 });
    root.getBoundingClientRect = vi.fn(() => ({ top: 100 }) as DOMRect);
    const ref = React.createRef<PdfCanvasVirtualViewerHandle>();
    render(<PdfCanvasVirtualViewer ref={ref} rootRef={{ current: root }} data={new Uint8Array([1])} />);
    const page = await screen.findByRole("group", { name: "第 1 页" });
    Object.defineProperty(page, "offsetTop", { value: 5000 });
    page.getBoundingClientRect = vi.fn(() => ({ top: 650 }) as DOMRect);
    act(() => ref.current!.scrollToPage(1));
    expect(root.scrollTo).toHaveBeenCalledWith({ top: 940, behavior: "smooth" });
  });

  it("reserves the PDF aspect ratio and scales the canvas proportionally in a narrow reader", async () => {
    const f = fixture(); mocks.getDocument.mockReturnValue(f.loading);
    render(<PdfCanvasVirtualViewer data={new Uint8Array([1])} />);
    const page = await screen.findByRole("group", { name: "第 1 页" });
    const canvas = page.querySelector("canvas")!;
    expect(canvas.parentElement).toHaveStyle({ width: "100%", maxWidth: "100px", aspectRatio: "100 / 200", position: "relative" });
    await intersect(page);
    expect(canvas).toHaveStyle({ width: "100%", height: "100%", position: "absolute" });
  });

});
