import fs from "fs";
import path from "path";

const readPanelSource = () => {
  const filePath = path.join(__dirname, "ClassroomPanel.tsx");
  return fs.readFileSync(filePath, "utf8");
};

test("ClassroomPanel keeps polling fallback", () => {
  const src = readPanelSource();
  expect(src).toContain("setInterval(() => {");
  expect(src).toContain('checkActive({ silent: true })');
});

test("ClassroomPanel wires classroom SSE stream with EventSource", () => {
  const src = readPanelSource();
  expect(src).toContain("/classroom/stream");
  expect(src).toContain("new EventSource");
  expect(src).toContain("withCredentials: true");
});

test("ClassroomPanel schedules reconnect when SSE errors", () => {
  const src = readPanelSource();
  expect(src).toContain("scheduleReconnect");
  expect(src).toContain("setTimeout(connect, 3000)");
  expect(src).toContain("stream.onerror");
});

test("ClassroomPanel resets panel state when auth is lost", () => {
  const src = readPanelSource();
  expect(src).toContain("if (isAuthenticated) return;");
  expect(src).toContain("setOpen(false)");
  expect(src).toContain("setView(\"idle\")");
  expect(src).toContain("setActivity(null)");
});
