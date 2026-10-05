import { describe, expect, it } from "vitest";
import { cn } from "./utils";

/**
 * 回归测试：语义间距 token 必须能被 tailwind-merge 正常覆盖。
 *
 * 背景（计划 §2.3 附带发现 + B5 前置）：tailwind-merge 默认不认识
 * p-panel-padding 这类语义 token，会把它当未知类，于是
 * cn("p-panel-padding", cond && "p-4") 两条都保留 ——
 * 条件失效时组件间距仍被后面的数字类改掉，是静默的视觉 bug。
 *
 * 这条测试曾经写不出来：它要求 classGroups 用嵌套对象
 * { p: [{ p: [...] }] } 而非 { p: [...] }，后者会另起平行路径、合并照旧失效。
 */
describe("cn 语义间距 token 覆盖（tailwind-merge 注册）", () => {
  it("语义 padding token 会被后出现的数字类覆盖，且只留数字类", () => {
    expect(cn("p-panel-padding", "p-4")).toBe("p-4");
    expect(cn("p-card-padding", "p-6")).toBe("p-6");
  });

  it("反向顺序：数字类在前、语义 token 在后，应保留语义 token", () => {
    expect(cn("p-4", "p-panel-padding")).toBe("p-panel-padding");
  });

  it("gap 类同样生效（数值方向与语义方向都可覆盖）", () => {
    expect(cn("gap-item-gap", "gap-2")).toBe("gap-2");
    expect(cn("gap-item-gap", "gap-section-gap")).toBe("gap-section-gap");
    expect(cn("gap-section-gap", "gap-item-gap")).toBe("gap-item-gap");
  });

  it("纵向前缀 py / mt / space-y 生效", () => {
    expect(cn("py-form-field-gap", "py-2")).toBe("py-2");
    expect(cn("mt-item-gap", "mt-6")).toBe("mt-6");
    expect(cn("space-y-form-field-gap", "space-y-2")).toBe("space-y-2");
  });

  it("不同属性前缀之间互不覆盖（px 不应吃掉 py）", () => {
    expect(cn("px-card-padding", "py-form-field-gap")).toBe("px-card-padding py-form-field-gap");
  });

  it("同前缀内：px 覆盖 pr 属正常合并，不回归", () => {
    expect(cn("px-card-padding", "pr-2")).toBe("px-card-padding pr-2");
  });

  it("hover: 等修饰符各自成组，互不干扰", () => {
    expect(cn("p-panel-padding", "hover:p-4")).toBe("p-panel-padding hover:p-4");
    expect(cn("hover:gap-item-gap", "hover:gap-2")).toBe("hover:gap-2");
  });

  it("条件类（false / undefined）不参与覆盖，语义 token 保留", () => {
    expect(cn("p-panel-padding", false && "p-4")).toBe("p-panel-padding");
    expect(cn("p-panel-padding", undefined)).toBe("p-panel-padding");
    expect(cn("p-panel-padding", true && "p-4")).toBe("p-4");
  });

  it("非间距类不受影响", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
    expect(cn("bg-surface", "p-2")).toBe("bg-surface p-2");
  });

  it("语义 token 与自身重复时只保留最后一个", () => {
    expect(cn("p-panel-padding", "p-card-padding")).toBe("p-card-padding");
  });
});