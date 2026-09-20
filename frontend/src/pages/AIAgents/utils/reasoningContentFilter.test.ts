import { describe, expect, it } from "vitest";

import {
  createReasoningContentFilter,
  sanitizeReasoningContent,
} from "./reasoningContentFilter";

describe("reasoningContentFilter", () => {
  it("removes a complete Dify reasoning block", () => {
    expect(
      sanitizeReasoningContent(
        "<think>\n<!--dify-deepseek-reasoning-->\n内部推理\n</think>\n正式回答",
      ),
    ).toBe("\n正式回答");
  });

  it("removes markers split across stream chunks", () => {
    const filter = createReasoningContentFilter();
    const output = [
      filter.push("<th"),
      filter.push("ink>内部推"),
      filter.push("理</thi"),
      filter.push("nk>正式"),
      filter.push("回答"),
      filter.finish(),
    ].join("");

    expect(output).toBe("正式回答");
  });

  it("fails closed when a reasoning block is not terminated", () => {
    expect(sanitizeReasoningContent("<think>不能展示的内容")).toBe("");
  });

  it("removes a standalone Dify marker", () => {
    expect(
      sanitizeReasoningContent("<!--dify-deepseek-reasoning-->正式回答"),
    ).toBe("正式回答");
  });

  it("preserves ordinary markdown", () => {
    const markdown = "## 结论\n\n```html\n<thinking>示例</thinking>\n```";
    expect(sanitizeReasoningContent(markdown)).toBe(markdown);
  });

  it("is idempotent", () => {
    const cleaned = sanitizeReasoningContent("<think>隐藏</think>显示");
    expect(sanitizeReasoningContent(cleaned)).toBe(cleaned);
  });
});
