import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// 断点由 mock 控制，直接断言 SplitPanePage 在两种断点下的内联网格样式。
const viewport = vi.hoisted(() => ({ md: true }));
vi.mock("@/hooks/useBreakpoint", () => ({ useBreakpoint: () => viewport }));

import SplitPanePage from "./SplitPanePage";

// 注意：jsdom 不做真实布局计算，这里只锁定「两行网格 + 左侧限高/可滚动」的样式契约；
// 真实 375px 下目录可见且可滚动由 Chromium 实测另行验证（见发布验证记录）。
const renderPane = () => {
  const { container } = render(
    <SplitPanePage
      left={<div data-testid="left">目录</div>}
      right={<div data-testid="right">正文</div>}
    />
  );
  const grid = container.firstElementChild as HTMLElement;
  const leftWrapper = grid.children[0] as HTMLElement;
  const rightWrapper = grid.children[1] as HTMLElement;
  return { grid, leftWrapper, rightWrapper };
};

describe("SplitPanePage 响应式网格契约", () => {
  afterEach(() => {
    cleanup();
    viewport.md = true;
  });

  it("窄屏时声明两行网格，避免第二列落到隐式行把第一行压成 0", () => {
    viewport.md = false;
    const { grid } = renderPane();

    expect(grid.style.gridTemplateRows).toBe("auto minmax(0, 1fr)");
    expect(grid.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
  });

  it("窄屏时左侧包装层限高 40vh、可滚动且 alignSelf 为 start", () => {
    viewport.md = false;
    const { leftWrapper, rightWrapper } = renderPane();

    expect(leftWrapper.style.maxHeight).toBe("40vh");
    expect(leftWrapper.style.overflowY).toBe("auto");
    // stretch 会把子项拉满导致 maxHeight 只夹住盒子、内部内容被压扁而不滚动
    expect(leftWrapper.style.alignSelf).toBe("start");
    // 右侧保持占满剩余行
    expect(rightWrapper.style.height).toBe("100%");
  });

  it("桌面端行为完全不变：单行网格、左侧撑满高度、不限高不滚动", () => {
    viewport.md = true;
    const { grid, leftWrapper, rightWrapper } = renderPane();

    expect(grid.style.gridTemplateRows).toBe("minmax(0, 1fr)");
    expect(grid.style.gridTemplateColumns).toBe("420px minmax(0, 1fr)");
    expect(leftWrapper.style.height).toBe("100%");
    expect(leftWrapper.style.maxHeight).toBe("");
    expect(leftWrapper.style.overflowY).toBe("");
    expect(leftWrapper.style.alignSelf).toBe("");
    expect(rightWrapper.style.height).toBe("100%");
  });

  it("leftWidth 参数在桌面端生效，窄屏时让位于单列", () => {
    viewport.md = true;
    const { container } = render(
      <SplitPanePage leftWidth={280} left={<div />} right={<div />} />
    );
    expect((container.firstElementChild as HTMLElement).style.gridTemplateColumns).toBe(
      "280px minmax(0, 1fr)"
    );

    cleanup();
    viewport.md = false;
    const { container: mobileContainer } = render(
      <SplitPanePage leftWidth={280} left={<div />} right={<div />} />
    );
    expect((mobileContainer.firstElementChild as HTMLElement).style.gridTemplateColumns).toBe(
      "minmax(0, 1fr)"
    );
  });
});
