import { describe, expect, it } from "vitest";

import { isMindmapEditorRuntimeAvailable } from "./mindmapRuntime";

describe("mindmap runtime boundary", () => {
  it("keeps the local editor available for development and tests", () => {
    expect(isMindmapEditorRuntimeAvailable("development")).toBe(true);
    expect(isMindmapEditorRuntimeAvailable("test")).toBe(true);
    expect(isMindmapEditorRuntimeAvailable(undefined)).toBe(true);
  });

  it("disables the excluded editor runtime in production", () => {
    expect(isMindmapEditorRuntimeAvailable("production")).toBe(false);
  });
});
