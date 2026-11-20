import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "vitest";

const source = readFileSync(
  path.resolve(process.cwd(), "src/pages/AIAgents/GroupDiscussionPanel.tsx"),
  "utf8",
);

test("consumes access_revoked and stops forbidden polling", () => {
  expect(source).toContain('addEventListener("access_revoked"');
  expect(source).toContain('result === "forbidden"');
});

test("stops fallback polling when the discussion group was deleted (404)", () => {
  // listMessages 内部吞掉异常，因此 404 必须作为终态返回并停止轮询，
  // 否则已删除的讨论组会被每 3 秒无限重试。
  expect(source).toContain('result === "missing"');
  expect(source).toContain("res.missing");
  expect(source).not.toMatch(/loadMessages\(sessionId\)\.catch/);
});

test("clears the fallback polling timer on cleanup", () => {
  expect(source).toContain("window.clearTimeout(pollTimer)");
  const cleanup = source.slice(source.indexOf("return () => {", source.indexOf("new EventSource")));
  expect(cleanup).toContain("stopPolling()");
});

test("SSE subscription does not depend on filter callbacks that change identity", () => {
  // handleExit -> fetchGroups 依赖 open/view/searchKeyword/filterDate/filterClass，
  // 直接放进依赖数组会让筛选变化触发 SSE 重连。
  expect(source).toContain("handleExitRef.current = handleExit");
  expect(source).toContain("loadMessagesRef.current = loadMessages");
  expect(source).toContain(
    "}, [open, isAuthenticated, view, sessionId, userId]);",
  );
});

test("fallback polling backs off instead of hammering a failing backend", () => {
  expect(source).toContain("const POLL_BASE_MS = 3000");
  expect(source).toContain("const POLL_MAX_MS = 30000");
  expect(source).toContain("Math.min(pollDelay * 2, POLL_MAX_MS)");
  expect(source).toContain("pollDelay = result === \"error\" ?");
});

test("hidden panel keeps no SSE stream or polling alive", () => {
  expect(source).toMatch(
    /if \(!open \|\| !isAuthenticated \|\| view !== "chat" \|\| !sessionId\) return;/,
  );
});
