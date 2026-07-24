import { describe, expect, it } from "vitest";

import { isWorkflowEventContent } from "./ChatArea";

describe("isWorkflowEventContent", () => {
  it("does not hide an ordinary answer that discusses errors", () => {
    expect(isWorkflowEventContent("常见错误包括没有保存回答。")).toBe(false);
  });

  it("recognizes only explicit workflow status messages", () => {
    expect(isWorkflowEventContent("工作流启动")).toBe(true);
    expect(isWorkflowEventContent("工作流节点：检索资料")).toBe(true);
    expect(isWorkflowEventContent("节点完成：检索资料")).toBe(true);
    expect(isWorkflowEventContent("工作流错误：上游服务不可用")).toBe(true);
  });
});
