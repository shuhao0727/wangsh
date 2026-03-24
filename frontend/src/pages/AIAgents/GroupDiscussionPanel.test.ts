import fs from "fs";
import path from "path";

const readPanelSource = () => {
  const filePath = path.join(__dirname, "GroupDiscussionPanel.tsx");
  return fs.readFileSync(filePath, "utf8");
};

test("GroupDiscussionPanel gates SSE with authentication state", () => {
  const src = readPanelSource();
  expect(src).toContain("if (!isAuthenticated || view !== \"chat\" || !sessionId) return;");
  expect(src).toContain("new EventSource");
  expect(src).toContain("/ai-agents/group-discussion/stream");
});

test("GroupDiscussionPanel clears session storage on auth loss", () => {
  const src = readPanelSource();
  expect(src).toContain("clearDiscussionSessionState");
  expect(src).toContain("localStorage.removeItem(STORAGE_KEYS.SESSION_ID)");
  expect(src).toContain("setOpen(false)");
  expect(src).toContain("setMembersDrawerOpen(false)");
});

test("GroupDiscussionPanel keeps explicit manual exit flow", () => {
  const src = readPanelSource();
  expect(src).toContain("const handleExit = useCallback");
  expect(src).toContain("void fetchGroups()");
});

test("GroupDiscussionPanel requires class name when admin creates group", () => {
  const src = readPanelSource();
  expect(src).toContain("label=\"班级 (必填)\"");
  expect(src).toContain("name=\"className\"");
  expect(src).toContain("请先填写班级");
});
