import assert from "node:assert/strict";
import test from "node:test";
import {
  breakpointIsVisible,
  isDebugCompletion,
  readDebugCompletionSnapshot,
  smokeResultSummary,
} from "./pythonlab-smoke-contracts.mjs";

function withDocument(document, run) {
  const previous = globalThis.document;
  globalThis.document = document;
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

function row(number, top) {
  return {
    querySelector: () => ({ textContent: String(number) }),
    getBoundingClientRect: () => ({ top, bottom: top + 20 }),
  };
}

function marker(top) {
  return { getBoundingClientRect: () => ({ top, height: 16, width: 16 }) };
}

test("breakpoint assertion requires an exact line and its own marker", () => {
  const rows = [row(2, 20), row(6, 100), row(12, 220)];
  let markers = [marker(22)];
  withDocument({
    querySelectorAll: (selector) => selector.includes(".wsMonacoBp") ? markers : rows,
  }, () => {
    assert.equal(breakpointIsVisible(2), true);
    assert.equal(breakpointIsVisible(6), false);
    markers = [marker(102), marker(222)];
    assert.equal(breakpointIsVisible(2), false);
    assert.equal(breakpointIsVisible(6), true);
    assert.equal(breakpointIsVisible(12), true);
  });
});

test("running state with a disabled Continue and cleared variables is not completion", () => {
  const base = { continueDisabled: true, hasSpinner: false, outputRows: ["5"] };
  assert.equal(isDebugCompletion({ ...base, status: "运行中 · 调试 · DAP" }, "5"), false);
  assert.equal(isDebugCompletion({ ...base, status: "已暂停 · 调试 · DAP" }, "5"), false);
  assert.equal(isDebugCompletion({ ...base, status: "已停止 · 调试 · DAP" }, "5"), true);
});

test("completion requires exact output, a stopped state and an inactive Continue", () => {
  const done = { status: "已停止 · 调试 · DAP", continueDisabled: true, hasSpinner: false, outputRows: ["5"] };
  assert.equal(isDebugCompletion({ ...done, outputRows: ["15"] }, "5"), false);
  assert.equal(isDebugCompletion({ ...done, outputRows: [] }, "5"), false);
  assert.equal(isDebugCompletion({ ...done, hasSpinner: true }, "5"), false);
  assert.equal(isDebugCompletion({ ...done, continueDisabled: false }, "5"), false);
});

test("completion snapshot reads the DAP status region and terminal rows only", () => {
  const continueButton = { disabled: true, querySelector: () => ({}) };
  withDocument({
    querySelectorAll: (selector) => {
      if (selector === "button") return [continueButton];
      if (selector === '[role="status"]') return [{ textContent: "Other notification" }, { textContent: "已停止 · 调试 · DAP" }];
      if (selector === ".xterm-rows > div") return [{ textContent: " 5 " }, { textContent: "" }];
      return [];
    },
    querySelector: () => null,
  }, () => {
    const snapshot = readDebugCompletionSnapshot();
    assert.equal(isDebugCompletion(snapshot, "5"), true);
    assert.deepEqual(snapshot.outputRows, ["5"]);
    assert.deepEqual(readDebugCompletionSnapshot("5"), snapshot);
    assert.equal(readDebugCompletionSnapshot("15"), false);
  });
});

test("smoke summary never publishes raw error, page diagnostics or storage", () => {
  const summary = smokeResultSummary({
    id: "debug-happy-path", status: "FAIL", stage: "wait-finished", error: "ws://user:secret@internal/path?token=raw-page-data",
    diagnostics: { cookie: "must-not-be-published" }, bodyText: "private-page-text",
  });
  assert.deepEqual(summary, { id: "debug-happy-path", status: "FAIL", stage: "wait-finished", error: "scenario_failed" });
  assert.equal(JSON.stringify(summary).includes("secret"), false);
  assert.equal(smokeResultSummary({ id: "success", status: "PASS" }).error, null);
});
