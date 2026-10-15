import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Reader from "@/pages/Informatics/Reader";

const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), exportPdf: vi.fn(), toast: vi.fn(), loaded: null as null | ((pdf: any) => void) }));
vi.mock("@services", () => ({ publicTypstNotesApi: mocks }));
vi.mock("@/lib/toast", () => ({ showMessage: { error: mocks.toast } }));
vi.mock("@components/Pdf/PdfCanvasVirtualViewer", () => ({
  default: React.forwardRef((props: { data: Uint8Array | null; onPdfLoaded: (pdf: any) => void }, _ref) => {
    mocks.loaded = props.onPdfLoaded;
    return props.data ? <div data-testid="reader-bytes">{Array.from(props.data).join(",")}</div> : null;
  }),
}));
const deferred = <T,>() => {
  let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const items = [1, 2].map((id) => ({ id, title: `文档${id}`, updated_at: "2026-10-11", category_path: "" }));
beforeEach(() => {
  vi.resetAllMocks(); mocks.loaded = null;
  window.innerWidth = 1024;
  mocks.list.mockResolvedValue(items);
  mocks.get.mockImplementation(async (id: number) => ({ ...items[id - 1], pdf_available: true }));
  mocks.exportPdf.mockImplementation(async (id: number) => ({ arrayBuffer: async () => new Uint8Array([id]).buffer }));
});
afterEach(cleanup);

describe("public Reader lifecycle", () => {
  it("clears a mobile selection and ignores its delayed metadata without starting a PDF export", async () => {
    window.innerWidth = 390;
    const pending = deferred<unknown>(); mocks.get.mockReturnValueOnce(pending.promise);
    render(<Reader />);
    fireEvent.click(await screen.findByRole("button", { name: "文档1" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getAllByRole("button").find((button) => button.querySelector(".lucide-arrow-left"))!);
    await act(async () => pending.resolve({ ...items[0], pdf_available: true }));
    expect(mocks.exportPdf).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reader-bytes")).toBeNull();
  });

  it("does not let an earlier outline overwrite the latest outline for the same document", async () => {
    render(<Reader />); await screen.findByTestId("reader-bytes");
    const oldOutline = deferred<unknown[]>();
    const oldPdf = { getOutline: vi.fn(() => oldOutline.promise), getDestination: vi.fn() };
    const latestPdf = { getOutline: vi.fn().mockResolvedValue([{ title: "最新目录", dest: [0] }]) };
    await act(async () => { mocks.loaded!(oldPdf); mocks.loaded!(latestPdf); });
    await act(async () => oldOutline.resolve([{ title: "过时目录", dest: "late" }]));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "目录大纲" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("tab", { name: "目录大纲" }));
    expect(await screen.findByRole("button", { name: /最新目录/ })).toBeInTheDocument();
    expect(oldPdf.getDestination).not.toHaveBeenCalled();
  });

  it("stops obsolete outline traversal after switching documents", async () => {
    render(<Reader />); await screen.findByTestId("reader-bytes");
    const outline = deferred<unknown[]>();
    const pdf = { getOutline: vi.fn(() => outline.promise), getDestination: vi.fn() };
    await act(async () => mocks.loaded!(pdf));
    fireEvent.click(screen.getByRole("button", { name: "文档2" }));
    await waitFor(() => expect(screen.getByTestId("reader-bytes")).toHaveTextContent("2"));
    await act(async () => outline.resolve([{ title: "旧目录", dest: "late" }]));
    expect(pdf.getDestination).not.toHaveBeenCalled();
  });

  it("does not launch a PDF reload after a list refresh completes following unmount", async () => {
    render(<Reader />); await screen.findByTestId("reader-bytes");
    const list = deferred<typeof items>(); mocks.list.mockReturnValueOnce(list.promise);
    const exportsBefore = mocks.exportPdf.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "刷新文档列表" }));
    cleanup();
    await act(async () => list.resolve(items));
    expect(mocks.exportPdf).toHaveBeenCalledTimes(exportsBefore);
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
