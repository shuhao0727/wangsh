import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InformaticsDetailPage from "@/pages/Informatics/Detail";
import type { PublicTypstNote } from "@services";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  exportPdf: vi.fn(),
  navigate: vi.fn(),
  toastError: vi.fn(),
  viewer: vi.fn(),
  params: { id: "7" },
}));
vi.mock("@services", () => ({ publicTypstNotesApi: { get: mocks.get, exportPdf: mocks.exportPdf } }));
vi.mock("@/lib/toast", () => ({ showMessage: { error: mocks.toastError } }));
vi.mock("react-router-dom", () => ({ useParams: () => mocks.params, useNavigate: () => mocks.navigate }));
vi.mock("@components/Pdf/PdfCanvasVirtualViewer", () => ({
  default: ({ data }: { data: Uint8Array | null }) => {
    mocks.viewer(data);
    return data ? <div data-testid="pdf-content-fixture">{Array.from(data).join(",")}</div> : null;
  },
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const note: PublicTypstNote = {
  id: 7,
  title: "公开 PDF",
  summary: "公开摘要，不改文档内容",
  updated_at: "2026-10-07T12:00:00Z",
  pdf_available: true,
  toc: ["目录一", { text: "目录二", level: 2 }, { text: { text: "目录三" }, level: 3 }],
};
const pdfBlob = (bytes = [37, 80, 68, 70]) => ({
  arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array(bytes).buffer),
}) as unknown as Blob;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params.id = "7";
  mocks.get.mockResolvedValue(note);
  mocks.exportPdf.mockResolvedValue(pdfBlob());
});
afterEach(cleanup);

describe("public Informatics Detail states and shell colors", () => {
  it("ignores stale note metadata and never exports the previous note under a new route", async () => {
    const old = deferred<PublicTypstNote>();
    const next = deferred<PublicTypstNote>();
    mocks.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const { rerender } = render(<InformaticsDetailPage />);
    mocks.params.id = "8";
    rerender(<InformaticsDetailPage />);
    await act(async () => old.resolve(note));
    expect(mocks.exportPdf).not.toHaveBeenCalled();
    await act(async () => next.resolve({ ...note, id: 8 }));
    await screen.findByTestId("pdf-content-fixture");
    expect(mocks.exportPdf).toHaveBeenCalledExactlyOnceWith(8, note.updated_at);
  });

  it("does not navigate or toast when note loading rejects after unmount", async () => {
    const pending = deferred<PublicTypstNote>();
    mocks.get.mockReturnValueOnce(pending.promise);
    const { unmount } = render(<InformaticsDetailPage />);
    unmount();
    await act(async () => pending.reject(new Error("obsolete metadata")));
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("keeps loading accessible and visible on the permanent light shell", () => {
    mocks.get.mockReturnValue(deferred<PublicTypstNote>().promise);
    const { container } = render(<InformaticsDetailPage />);
    expect(container.firstElementChild).toHaveClass("bg-module-shell-surface", "text-module-shell-text");
    const loading = screen.getByRole("status", { name: "正在加载笔记…" });
    expect(loading).toHaveClass("text-module-shell-muted");
    expect(loading.querySelector("span")).not.toHaveClass("sr-only");
    expect(mocks.exportPdf).not.toHaveBeenCalled();
  });

  it("passes public ID/cache key and unmodified PDF bytes through a focused reader shell", async () => {
    render(<InformaticsDetailPage />);
    const fixture = await screen.findByTestId("pdf-content-fixture");
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(7);
    expect(mocks.exportPdf).toHaveBeenCalledExactlyOnceWith(7, note.updated_at);
    expect(fixture).toHaveTextContent("37,80,68,70");
    expect(mocks.viewer.mock.calls.at(-1)![0]).toEqual(new Uint8Array([37, 80, 68, 70]));
    const shell = screen.getByRole("region", { name: "PDF 阅读器" });
    expect(shell).toHaveAttribute("tabindex", "0");
    expect(shell).toHaveAttribute("aria-busy", "false");
    expect(shell.style.userSelect).toBe("none");
    expect(shell).toHaveClass("no-copy");
    expect(shell.style.filter).toBe("");
    expect(shell.style.opacity).toBe("");
    const toc = screen.getByText("目录").closest(".rounded-xl")!;
    expect(toc).toHaveClass("border-module-shell-border", "bg-module-shell-surface-2", "text-module-shell-text");
    expect(screen.getByText("目录二").parentElement!.style.paddingLeft).toBe("12px");
    expect(screen.getByText("目录三").parentElement!.style.paddingLeft).toBe("24px");
    expect(screen.getByText(note.summary!)).toHaveClass("text-module-shell-muted");
    const back = screen.getByRole("button", { name: "返回" });
    expect(back).toHaveClass("bg-module-shell-input", "hover:bg-module-shell-hover", "focus-visible:ring-module-shell-focus");
    fireEvent.click(back);
    expect(mocks.navigate).toHaveBeenCalledWith("/informatics");
  });

  it("shows the visible PDF loading state and does not mount the canvas while export is pending", async () => {
    const pending = deferred<Blob>();
    mocks.exportPdf.mockReturnValue(pending.promise);
    render(<InformaticsDetailPage />);
    const loading = await screen.findByRole("status", { name: "正在加载 PDF…" });
    expect(loading).toHaveClass("text-module-shell-muted");
    expect(loading.querySelector("span")).not.toHaveClass("sr-only");
    expect(screen.getByRole("region", { name: "PDF 阅读器" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("pdf-content-fixture")).toBeNull();
    await act(async () => pending.resolve(pdfBlob()));
    await screen.findByTestId("pdf-content-fixture");
  });

  it("preserves the existing unavailable-PDF early return and its exact business message", async () => {
    mocks.get.mockResolvedValue({ ...note, pdf_available: false });
    render(<InformaticsDetailPage />);
    const status = await screen.findByRole("status", { name: "PDF 尚未生成" });
    expect(status).toHaveClass("bg-info-soft", "text-info-text");
    expect(status).toHaveTextContent("PDF 暂未生成，请联系管理员编译");
    expect(status).toHaveTextContent("这篇内容已经发布，但管理员还没有生成可供公开阅读的 PDF。");
    expect(mocks.exportPdf).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pdf-content-fixture")).toBeNull();
  });

  it("keeps export error payload text and toast unchanged with a non-color error cue", async () => {
    mocks.exportPdf.mockRejectedValue({ response: { data: { detail: "业务前缀：compile failed\nimages/a.png" } } });
    render(<InformaticsDetailPage />);
    const status = await screen.findByRole("status", { name: "文档加载失败" });
    expect(status).toHaveClass("bg-error-soft", "text-error-text");
    expect(status).toHaveTextContent("文档加载失败");
    expect(status).toHaveTextContent("业务前缀：compile failed images/a.png");
    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith("业务前缀：compile failed\nimages/a.png");
    expect(screen.queryByTestId("pdf-content-fixture")).toBeNull();
  });

  it("preserves the same no-PDF message when the export endpoint reports it", async () => {
    mocks.exportPdf.mockRejectedValue(new Error("PDF 暂未生成，请联系管理员编译"));
    render(<InformaticsDetailPage />);
    expect(await screen.findByRole("status", { name: "PDF 尚未生成" })).toHaveClass("bg-info-soft", "text-info-text");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("does not overwrite newer public PDF bytes when an older export finishes later", async () => {
    const oldExport = deferred<Blob>();
    mocks.exportPdf.mockReturnValueOnce(oldExport.promise);
    const { rerender } = render(<InformaticsDetailPage />);
    await waitFor(() => expect(mocks.exportPdf).toHaveBeenCalledTimes(1));
    mocks.params.id = "8";
    mocks.get.mockResolvedValue({ ...note, id: 8, title: "较新的公开 PDF" });
    mocks.exportPdf.mockResolvedValue(pdfBlob([8, 8]));
    rerender(<InformaticsDetailPage />);
    expect(await screen.findByTestId("pdf-content-fixture")).toHaveTextContent("8,8");
    await act(async () => oldExport.resolve(pdfBlob([7, 7])));
    expect(screen.getByTestId("pdf-content-fixture")).toHaveTextContent("8,8");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("invalidates pending export work on unmount without a late toast", async () => {
    const pending = deferred<Blob>();
    mocks.exportPdf.mockReturnValue(pending.promise);
    const { unmount } = render(<InformaticsDetailPage />);
    await screen.findByRole("status", { name: "正在加载 PDF…" });
    unmount();
    await act(async () => pending.reject(new Error("late export fixture")));
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("preserves invalid-ID and missing-note navigation behavior", async () => {
    mocks.params.id = "0";
    const { unmount } = render(<InformaticsDetailPage />);
    expect(mocks.navigate).toHaveBeenCalledWith("/informatics");
    expect(mocks.get).not.toHaveBeenCalled();
    unmount();
    mocks.params.id = "7";
    mocks.get.mockRejectedValue({ response: { data: { detail: "内容不存在" } } });
    render(<InformaticsDetailPage />);
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("内容不存在"));
    expect(mocks.navigate).toHaveBeenCalledWith("/informatics");
    expect(mocks.exportPdf).not.toHaveBeenCalled();
  });
});
