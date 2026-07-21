import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySmokeAction,
  summarizeSmokeStatuses,
} from "./prod-smoke-ui-lib.mjs";

test("detects only the real not-found page markers", async () => {
  let isNotFoundPage;
  try {
    ({ isNotFoundPage } = await import("./prod-smoke-ui-lib.mjs"));
  } catch {
    // The assertion below keeps the red phase focused on the missing helper.
  }

  assert.equal(typeof isNotFoundPage, "function");

  const createPage = ({ codeCount, messageCount }) => ({
    getByText: (text) => ({
      count: async () =>
        text === "抱歉，您访问的页面不存在。" ? messageCount : codeCount,
    }),
  });

  const pageWithBusiness404 = createPage({ codeCount: 1, messageCount: 0 });
  const realNotFoundPage = createPage({ codeCount: 1, messageCount: 1 });

  assert.equal(await isNotFoundPage(pageWithBusiness404), false);
  assert.equal(await isNotFoundPage(realNotFoundPage), true);
});

test("marks skipped UI smoke actions as warnings instead of passes", () => {
  assert.deepEqual(classifySmokeAction("skip-no-title-input"), {
    status: "WARN",
    note: "action skipped: skip-no-title-input",
  });
  assert.deepEqual(classifySmokeAction("fill-title"), {
    status: null,
    note: "",
  });
});

test("propagates UI page warnings to the prod-smoke step marker", () => {
  assert.deepEqual(summarizeSmokeStatuses({ pass: 12, warn: 1, fail: 0 }), {
    level: "WARN",
    message: "UI smoke: 12 passed, 1 warned, 0 failed",
  });
  assert.deepEqual(summarizeSmokeStatuses({ pass: 13, warn: 0, fail: 0 }), {
    level: "OK",
    message: "UI smoke: 13 passed, 0 warned, 0 failed",
  });
});
