import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "@/components/ui/spinner";
import { LoadingState } from "@/components/ui/loading-state";

describe("Spinner", () => {
  it("默认尺寸为 sm(4)，且合并自定义 className", () => {
    const { container } = render(<Spinner data-testid="s" className="text-primary" />);
    const el = container.querySelector('[data-testid="s"]')!;
    expect(el.getAttribute("class")).toContain("h-4");
    expect(el.getAttribute("class")).toContain("w-4");
    expect(el.getAttribute("class")).toContain("animate-spin");
    expect(el.getAttribute("class")).toContain("text-primary");
  });

  it.each([
    ["xs", "h-3.5"],
    ["sm", "h-4"],
    ["md", "h-5"],
    ["lg", "h-6"],
    ["1.5x", "h-7"],
    ["xl", "h-8"],
    ["2xl", "h-9"],
    ["3xl", "h-10"],
  ] as const)("size=%s 渲染 %s", (size, expected) => {
    const { container } = render(<Spinner size={size} data-testid="s" />);
    const el = container.querySelector('[data-testid="s"]')!;
    expect(el.getAttribute("class")).toContain(expected);
  });

  it("不传 label 时是装饰性元素（aria-hidden，不谎报 role）", () => {
    render(<Spinner />);
    // 没有 label 就不应该出现 status 角色
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("传 label 时可被无障碍树识别为 status 且带可访问名称", () => {
    render(<Spinner label="正在加载" />);
    expect(screen.getByRole("status", { name: "正在加载" })).toBeTruthy();
  });
});

describe("LoadingState", () => {
  it("默认渲染 status 角色与默认可访问名称", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status", { name: "加载中…" })).toBeTruthy();
  });

  it("自定义 label 成为可访问名称", () => {
    render(<LoadingState label="正在保存" />);
    expect(screen.getByRole("status", { name: "正在保存" })).toBeTruthy();
  });

  it("block 变体有留白（走语义 token p-panel-padding），inline 变体没有", () => {
    // 留白用语义 token 而非数字类 py-12：仓库有 ui:spacing:ci 门禁统计数字间距类，
    // 在组件里新写 py-12 会被判为新增 px 债务，改用语义 token 既过门禁也更符合规范。
    const { container: blockC } = render(<LoadingState variant="block" />);
    expect(blockC.firstElementChild!.getAttribute("class")).toContain("p-panel-padding");

    const { container: inlineC } = render(<LoadingState variant="inline" />);
    expect(inlineC.firstElementChild!.getAttribute("class")).not.toContain("p-panel-padding");
  });

  it("默认 label 对屏幕阅读器可见但不占视觉空间（sr-only）", () => {
    render(<LoadingState label="加载中…" />);
    const span = screen.getByText("加载中…");
    expect(span.getAttribute("class")).toContain("sr-only");
  });

  it("showLabel=true 时文案可见", () => {
    render(<LoadingState label="加载中…" showLabel />);
    const span = screen.getByText("加载中…");
    expect(span.getAttribute("class")).not.toContain("sr-only");
  });
});
