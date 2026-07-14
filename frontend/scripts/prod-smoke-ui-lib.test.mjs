import assert from "node:assert/strict";
import test from "node:test";

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
