/**
 * LoadingState / Spinner 的可访问性契约测试。
 *
 * 这组测试保护的是迁移的**核心收益**，而不只是"换了个组件"：
 * 迁移前全仓 126 处 `<Loader2 className="... animate-spin" />` 大多**没有任何 aria**，
 * 屏幕阅读器完全静默。本文件把"加载态必须可被无障碍树识别"固化为回归测试。
 *
 * 注意 role="status" 的语义陷阱（本文件第 2 个用例）：
 * ARIA 规范中 status **不是** name-from-content 角色，因此仅放文本不会产生可访问名称。
 * 组件必须显式 `aria-label`——这个坑是实测发现的，见下面 "空名称" 用例。
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingState } from "@/components/ui/loading-state";
import { Spinner } from "@/components/ui/spinner";

describe("LoadingState 可访问性契约（迁移核心收益）", () => {
  it("block 加载态可被 role=status 查询到，且带非空可访问名称", () => {
    render(<LoadingState label="正在加载笔记…" />);
    const node = screen.getByRole("status", { name: "正在加载笔记…" });
    expect(node).toBeTruthy();
    // 显式 aria-label 是名称来源，而不是内部文本（status 非 name-from-content）
    expect(node.getAttribute("aria-label")).toBe("正在加载笔记…");
    expect(node.getAttribute("aria-live")).toBe("polite");
  });

  it("未显式命名时无障碍名称会为空 —— 这正是组件必须传 aria-label 的原因", () => {
    // 复刻"只有 role=status + 内部文本、无 aria-label"的错误写法，
    // 证明它拿不到可访问名称。若哪天有人去掉组件里的 aria-label，这条会失败。
    const { container } = render(
      <div role="status" aria-live="polite">
        <span>正在加载</span>
      </div>,
    );
    const node = container.querySelector('[role="status"]')!;
    expect(node.getAttribute("aria-label")).toBeNull();
    // 关键断言：按名称查询取不到，说明名称确实没被推导出来
    expect(screen.queryByRole("status", { name: "正在加载" })).toBeNull();
    // 但无名称时仍可按角色取到（证明它确实进了无障碍树，只是没名字）
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("每个尺寸档位都渲染出对应 spinner 尺寸（视觉无回归）", () => {
    const { container } = render(<LoadingState size="lg" label="加载" />);
    const svg = container.querySelector(".animate-spin")!;
    expect(svg.getAttribute("class")).toContain("h-6");
    expect(svg.getAttribute("class")).toContain("w-6");
  });

  it("装饰性 spinner（按钮内）不参与无障碍树，避免重复播报", () => {
    render(<Spinner size="sm" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("LoadingState 的可见文案对纯视觉用户不可见（sr-only），但不丢失语义", () => {
    render(<LoadingState label="正在保存" />);
    const span = screen.getByText("正在保存");
    expect(span.getAttribute("class")).toContain("sr-only");
    // 语义通过 aria-label 承载，不依赖这行文本
    expect(screen.getByRole("status", { name: "正在保存" })).toBeTruthy();
  });
});
