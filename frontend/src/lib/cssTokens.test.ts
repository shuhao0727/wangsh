import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COLOR_TOKEN_FALLBACKS,
  alphaColor,
  formatRgba,
  parseColor,
  readChartPalette,
  readCssColor,
  resolveCssColor,
} from "./cssTokens";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseColor", () => {
  it("解析 hex（3/4/6/8 位）与 rgb/rgba 的两种语法", () => {
    expect(parseColor("#0D9488")).toEqual({ red: 13, green: 148, blue: 136, alpha: 1 });
    expect(parseColor("#FFF")).toEqual({ red: 255, green: 255, blue: 255, alpha: 1 });
    expect(parseColor("#0D948888")).toEqual({
      red: 13,
      green: 148,
      blue: 136,
      alpha: 0x88 / 255,
    });
    expect(parseColor("rgba(13, 148, 136, 0.08)")).toEqual({ red: 13, green: 148, blue: 136, alpha: 0.08 });
    expect(parseColor("rgb(13 148 136 / 50%)")).toEqual({ red: 13, green: 148, blue: 136, alpha: 0.5 });
    expect(parseColor("transparent")).toEqual({ red: 0, green: 0, blue: 0, alpha: 0 });
  });

  it("拒绝非具体色表达式，避免把 var() 漏给 Canvas", () => {
    expect(parseColor("var(--ws-color-primary)")).toBeNull();
    expect(parseColor("color-mix(in srgb, red, blue)")).toBeNull();
    expect(parseColor("")).toBeNull();
    expect(parseColor("not-a-color")).toBeNull();
  });
});

describe("resolveCssColor / readCssColor", () => {
  it("无 DOM 可读值时落回镜像表（SSR 与测试环境的主路径）", () => {
    expect(readCssColor("--ws-color-primary")).toBe("#0D9488");
    expect(readCssColor("ws-color-primary")).toBe("#0D9488");
    expect(resolveCssColor("var(--ws-color-text-secondary)")).toBe("#475569");
  });

  it("原样放行已具体的色值字面量", () => {
    expect(resolveCssColor("#0D9488")).toBe("#0D9488");
    expect(resolveCssColor("rgba(13, 148, 136, 0.08)")).toBe("rgba(13, 148, 136, 0.08)");
  });

  it("遇到无法离线求值的 color-mix() 实时值时使用镜像等价色", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) =>
        name === "--ws-color-workspace-muted"
          ? "color-mix(in srgb, rgb(30, 41, 59) 3%, rgb(255, 255, 255))"
          : "",
    } as unknown as CSSStyleDeclaration);
    expect(readCssColor("--ws-color-workspace-muted")).toBe(COLOR_TOKEN_FALLBACKS["--ws-color-workspace-muted"]);
  });

  it("优先使用浏览器计算值，而不是镜像表", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) => (name === "--ws-color-primary" ? "#123456" : ""),
    } as unknown as CSSStyleDeclaration);
    expect(readCssColor("--ws-color-primary")).toBe("#123456");
  });

  it("未知 token 使用调用方 fallback，最终兜底不是黑色", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // 运行时拼接出不存在的 token 名，避免 token-check 把假 token 当成真实引用
    const missing = ["--ws", "color", "definitely", "missing"].join("-");
    expect(readCssColor(missing, "#ABCDEF")).toBe("#ABCDEF");
    expect(readCssColor(missing)).toBe("#1E293B");
    expect(warn).toHaveBeenCalled();
  });
});

describe("alphaColor", () => {
  it("在原 alpha 上相乘，不会把半透明 token 变成实色", () => {
    expect(alphaColor("#0D9488", 0.5)).toBe("rgba(13, 148, 136, 0.5)");
    // 原本 alpha=0.08 的 border，再乘 0.5 → 0.04，而不是覆盖成 0.5
    expect(alphaColor("rgba(0, 0, 0, 0.08)", 0.5)).toBe("rgba(0, 0, 0, 0.04)");
    expect(alphaColor("var(--ws-color-primary)", 0.2)).toBe("rgba(13, 148, 136, 0.2)");
  });

  it("alpha 越界会被钳制到 [0, 1]", () => {
    expect(alphaColor("#0D9488", 5)).toBe("rgba(13, 148, 136, 1)");
    expect(alphaColor("#0D9488", -1)).toBe("rgba(13, 148, 136, 0)");
    expect(alphaColor("#0D9488", Number.NaN)).toBe("rgba(13, 148, 136, 1)");
  });

  it("formatRgba 保留四位小数，避免浮点噪声进入 option", () => {
    expect(formatRgba({ red: 1, green: 2, blue: 3, alpha: 0.08000000000000002 })).toBe("rgba(1, 2, 3, 0.08)");
  });
});

describe("readChartPalette", () => {
  it("返回全部为具体色值的调色板（可直接进 Canvas）", () => {
    const palette = readChartPalette();
    for (const [key, value] of Object.entries(palette)) {
      if (key === "tags") continue;
      expect(typeof value, key).toBe("string");
      expect(parseColor(value as string), key).not.toBeNull();
    }
    expect(Object.keys(palette.tags)).toHaveLength(11);
    expect(palette.primary).toBe("#0D9488");
    expect(palette.accent).toBe("#7C3AED");
  });
});
