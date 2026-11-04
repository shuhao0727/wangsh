import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import XtermTerminal from "./XtermTerminal";

const fixture = vi.hoisted(() => ({ writes: [] as Array<string | Uint8Array> }));
vi.mock("xterm", () => ({
  Terminal: class {
    element?: HTMLElement;
    buffer = { active: { cursorX: 0, length: 0, viewportY: 0, baseY: 0 } };
    cols = 80;
    rows = 24;
    loadAddon() {}
    open(element: HTMLElement) { this.element = element; }
    onKey() {}
    onData() { return { dispose() {} }; }
    onScroll() { return { dispose() {} }; }
    onRender() { return { dispose() {} }; }
    write(data: string | Uint8Array) { fixture.writes.push(data); }
    focus() {}
    dispose() {}
    clear() {}
    refresh() {}
  },
}));
vi.mock("xterm-addon-fit", () => ({ FitAddon: class { fit() {} } }));
vi.mock("xterm/css/xterm.css", () => ({}));

class MemorySocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MemorySocket[] = [];
  readyState = 1;
  binaryType = "";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_url: string) { MemorySocket.instances.push(this); }
  close() { this.readyState = 3; }
  send() {}
}

beforeEach(() => {
  fixture.writes = [];
  MemorySocket.instances = [];
  vi.stubGlobal("WebSocket", MemorySocket);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(function () { return document.body; });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function readyFrame() {
  return Uint8Array.from([...'{"type":"pythonlab.terminal.ready","version":1}'].map((char) => char.charCodeAt(0))).buffer;
}

test("socket open is not ready; only binary acknowledgement releases it and stdout remains text", async () => {
  const ready = vi.fn();
  const view = render(<XtermTerminal wsUrl="ws://synthetic.invalid/terminal" onConnectionReady={ready} />);
  await waitFor(() => expect(MemorySocket.instances).toHaveLength(1));
  const socket = MemorySocket.instances[0];
  act(() => { socket.onopen?.(); });
  expect(ready).not.toHaveBeenCalledWith(true);
  act(() => { socket.onmessage?.({ data: readyFrame() }); });
  expect(ready).toHaveBeenLastCalledWith(true);
  act(() => { socket.onmessage?.({ data: "8\r\n" }); });
  expect(fixture.writes).toContain("8\r\n");
  expect(fixture.writes.every((chunk) => typeof chunk === "string")).toBe(true);
  act(() => { socket.onclose?.({ code: 1000 }); });
  expect(ready).toHaveBeenLastCalledWith(false);
  view.unmount();
});

test("a disposed connection cannot acknowledge a replacement terminal", async () => {
  const first = vi.fn();
  const second = vi.fn();
  const view = render(<XtermTerminal wsUrl="ws://synthetic.invalid/one" onConnectionReady={first} />);
  await waitFor(() => expect(MemorySocket.instances).toHaveLength(1));
  const oldMessage = MemorySocket.instances[0].onmessage;
  view.rerender(<XtermTerminal wsUrl="ws://synthetic.invalid/two" onConnectionReady={second} />);
  await waitFor(() => expect(MemorySocket.instances).toHaveLength(2));
  act(() => { oldMessage?.({ data: readyFrame() }); });
  expect(second).not.toHaveBeenCalledWith(true);
  act(() => { MemorySocket.instances[1].onmessage?.({ data: readyFrame() }); });
  expect(second).toHaveBeenLastCalledWith(true);
  view.unmount();
});
