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
