import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import PdfCanvasVirtualViewer from "./PdfCanvasVirtualViewer";

const pdf = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("@/utils/pdfInit", () => ({ getPdfJs: async () => pdf }));

beforeEach(() => {
  pdf.getDocument.mockReset();
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("PDF preview explicitly disables font eval while loading normal page metadata", async () => {
  const data = new Uint8Array([37, 80, 68, 70]);
  const document = {
    numPages: 1,
    getPage: vi.fn(async () => ({ getViewport: () => ({ width: 120, height: 160 }) })),
  };
  pdf.getDocument.mockReturnValue({ promise: Promise.resolve(document) });
  const onPdfLoaded = vi.fn();

  const view = render(<PdfCanvasVirtualViewer data={data} onPdfLoaded={onPdfLoaded} />);

  await waitFor(() => expect(view.container.querySelector("#page-1 canvas")).not.toBeNull());
  expect(pdf.getDocument).toHaveBeenCalledExactlyOnceWith({ data, isEvalSupported: false });
  expect(onPdfLoaded).toHaveBeenCalledWith(document);
  expect(document.getPage).toHaveBeenCalledWith(1);
});

test("each replacement PDF keeps eval disabled and null input does not parse", async () => {
  pdf.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 0 }) });
  const first = new Uint8Array([1]);
  const second = new Uint8Array([2]);
  const view = render(<PdfCanvasVirtualViewer data={null} />);
  expect(pdf.getDocument).not.toHaveBeenCalled();

  await act(async () => { view.rerender(<PdfCanvasVirtualViewer data={first} />); });
  await act(async () => { view.rerender(<PdfCanvasVirtualViewer data={second} />); });

  expect(pdf.getDocument.mock.calls).toEqual([
    [{ data: first, isEvalSupported: false }],
    [{ data: second, isEvalSupported: false }],
  ]);
});
