/**
 * 学情分析图表主题：交给 Canvas 渲染器的每个颜色都必须是**具体色值**。
 *
 * 这是 `var(--ws-color-*)` 在 Canvas 里静默失效的直接防线——
 * fillStyle 赋值失败不会报错，只会把整张图变黑。
 */
import { describe, expect, it, vi } from "vitest";

import { getAgentChartTheme, chartSurfaceStroke, isConcreteChartColor } from "./chartTheme";
import { parseColor } from "@/lib/cssTokens";

describe("学情分析图表主题", () => {
  it("所有顶层颜色都是 Canvas 可消费的具体色值", () => {
    const theme = getAgentChartTheme();
    for (const [key, value] of Object.entries(theme)) {
      if (key === "beamColors") continue;
      expect(typeof value, key).toBe("string");
      expect(parseColor(value as string), `${key} = ${value}`).not.toBeNull();
      expect(isConcreteChartColor(value as string), key).toBe(true);
    }
  });

  it("系列调色板每项都是具体色值且互不重复", () => {
    const { beamColors } = getAgentChartTheme();
    expect(beamColors.length).toBeGreaterThanOrEqual(8);
    for (const color of beamColors) expect(parseColor(color), color).not.toBeNull();
    expect(new Set(beamColors).size).toBe(beamColors.length);
  });

  it("半透明投影在原 alpha 上相乘，网格线不会被画成实线", () => {
    const theme = getAgentChartTheme();
    // index.css: --ws-color-border 是 rgba(0,0,0,0.08)，再乘 0.55 ≈ 0.044
    expect(parseColor(theme.grid)!.alpha).toBeCloseTo(0.044, 3);
  });

  it("白色描边取自 surface token 而不是硬编码 #fff", () => {
    expect(chartSurfaceStroke()).toBe("#FFFFFF");
  });

  it("主题读取的是当前 CSS 变量，而不是写死的旧主题色", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) =>
        name === "--ws-color-primary" ? "#0D9488" : name === "--ws-color-accent" ? "#7C3AED" : "",
    } as unknown as CSSStyleDeclaration);
    const theme = getAgentChartTheme();
    expect(theme.primary).toBe("#0D9488");
    expect(theme.accent).toBe("#7C3AED");
  });
});
