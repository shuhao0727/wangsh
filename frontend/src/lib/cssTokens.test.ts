import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alphaColor,
  parseColor,
  readCssColor,
  readCssToken,
  resolveCssColor,
  resolveEChartsOptionColors,
} from "./cssTokens";

describe("css token color bridge", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    vi.restoreAllMocks();
  });

  it("resolves nested CSS variables from the document root", () => {
    document.documentElement.style.setProperty("--test-base", "#0F766E");
    document.documentElement.style.setProperty("--test-alias", "var(--test-base)");
    document.documentElement.style.setProperty("--test-nested", "var(--test-alias)");

    expect(readCssToken("--test-alias")).toBe("#0F766E");
    expect(readCssToken("--test-nested")).toBe("#0F766E");
    expect(readCssColor("--test-alias", "#000000")).toBe("#0F766E");
    expect(alphaColor("var(--test-nested)", 0.5)).toBe("rgba(15, 118, 110, 0.5)");
  });

  it("supports hex, rgb, rgba, and modern slash-alpha syntax", () => {
    expect(parseColor("#abc")).toEqual({ red: 170, green: 187, blue: 204, alpha: 1 });
    expect(parseColor("#11223380")).toEqual({ red: 17, green: 34, blue: 51, alpha: 128 / 255 });
    expect(parseColor("rgb(10, 20, 30)")).toEqual({ red: 10, green: 20, blue: 30, alpha: 1 });
    expect(parseColor("rgba(10, 20, 30, 0.4)")).toEqual({ red: 10, green: 20, blue: 30, alpha: 0.4 });
    expect(parseColor("rgb(10 20 30 / 40%)")).toEqual({ red: 10, green: 20, blue: 30, alpha: 0.4 });
    expect(alphaColor("#0F766E", 0.25)).toBe("rgba(15, 118, 110, 0.25)");
    expect(alphaColor("rgba(15, 118, 110, 0.8)", 0.25)).toBe("rgba(15, 118, 110, 0.2)");
    expect(alphaColor("rgb(15 118 110 / 40%)", 0.5)).toBe("rgba(15, 118, 110, 0.2)");
  });

  it.each([
    "rgb(10px, 20, 30)", "rgb(10 20 30 0.4)", "rgba(10, 20, 30, 0.4 / 50%)",
    "rgb(10, 20, 30 / 40%)", "rgb(10%, 20, 30)", "rgba(10, 20, 30, 40%junk)",
    "rgb(10 20 30 /)", "rgb(10 20 30 / .4 / .5)", "rgb(1e309 20 30)",
    "rgb(10 20junk 30)", "rgba(10, 20, 30, 0.4junk)",
  ])("rejects malformed RGB syntax %j", (color) => {
    expect(parseColor(color)).toBeNull();
  });

  it("rounds percentage midpoints and preserves valid numeric/clamped syntax", () => {
    expect(parseColor("rgb(50% 50% 50%)")).toEqual({ red: 128, green: 128, blue: 128, alpha: 1 });
    expect(parseColor("rgba(50%, 50%, 50%, 50%)")).toEqual({ red: 128, green: 128, blue: 128, alpha: 0.5 });
    expect(parseColor("rgb(+1e1 .5 -20 / 5e-1)")).toEqual({ red: 10, green: 1, blue: 0, alpha: 0.5 });
    expect(parseColor("rgb(150% -20% 50% / 200%)")).toEqual({ red: 255, green: 0, blue: 128, alpha: 1 });
  });

  it("uses the token contract fallback outside the browser", () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: undefined });
    try {
      expect(readCssColor("--ws-color-primary-fill")).toBe("#0F766E");
      expect(readCssColor("--ws-color-primary-active")).toBe("#084C47");
      expect(readCssColor("--ws-color-interaction-hover")).toBe("rgba(15, 118, 110, 0.07)");
      expect(readCssColor("--ws-color-module-shell-hover")).toBe("rgba(15, 118, 110, 0.07)");
      expect(readCssColor("--ws-color-error")).toBe("#B42318");
      expect(resolveCssColor("var(--ws-color-brand-accent)")).toBe("#4F46E5");
    } finally {
      Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
    }
  });

  it("does not silently turn unknown or unsupported colors into black", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const unknownToken = ["--ws-color", "not-registered"].join("-");
    const unknownColor = `var(${unknownToken})`;
    expect(resolveCssColor(unknownColor)).toBe("#0F172A");
    expect(resolveCssColor("color-mix(in srgb, #fff 50%, #000)")).toBe("#0F172A");
    expect(resolveCssColor(unknownColor)).not.toBe("#000000");
    expect(warning).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["--test-invalid-live", "42px", "#112233", "#112233"],
    ["--ws-color-primary", "nope", "", "#0F766E"],
    ["--ws-color-primary", "rgb(10px, 20, 30)", "nope", "#0F766E"],
    ["--ws-color-primary", "42px", "#112233", "#112233"],
    ["--test-invalid-live", "nope", "also-invalid", "#0F172A"],
  ])("rejects invalid live %s=%s and uses validated fallback", (name, live, fallback, expected) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.documentElement.style.setProperty(name, live);
    expect(readCssColor(name, fallback)).toBe(expected);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("invalid or unsupported color"));
  });

  it.each([
    ["var(--test-unknown, nope)", "", "#0F172A"],
    ["var(--ws-color-primary, nope)", "", "#0F766E"],
    ["var(--test-unknown, nope)", "#112233", "#112233"],
    ["42px", "nope", "#0F172A"],
  ])("validates invalid expression/fallback %j", (value, fallback, expected) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveCssColor(value, fallback)).toBe(expected);
    expect(warning).toHaveBeenCalled();
  });

  it("warns consistently for unknown tokens through both color entry points", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(readCssColor("test-unknown", "#112233")).toBe("#112233");
    expect(resolveCssColor("var(--test-unknown)")).toBe("#0F172A");
    expect(warning).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("unknown color token --test-unknown"));
  });

  it("reads live colors on every call and does not evaluate an unused invalid fallback", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.documentElement.style.setProperty("--ws-color-primary", "#112233");
    expect(readCssColor("--ws-color-primary", "nope")).toBe("#112233");
    document.documentElement.style.setProperty("--ws-color-primary", "#445566");
    expect(readCssColor("--ws-color-primary", "nope")).toBe("#445566");
    expect(warning).not.toHaveBeenCalled();
  });

  it("recovers from a throwing computed-style read using inline, caller, or registered color", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => {
      throw new Error("style read failed");
    });
    document.documentElement.style.setProperty("--test-inline", "#123456");
    expect(readCssColor("--test-inline")).toBe("#123456");
    expect(readCssColor("--test-unknown", "#112233")).toBe("#112233");
    expect(readCssColor("--ws-color-primary")).toBe("#0F766E");
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("could not read computed CSS token"));
  });

  it("recovers when computed-style support is missing or inline reading also throws", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("getComputedStyle", undefined);
    try {
      vi.spyOn(document.documentElement.style, "getPropertyValue").mockImplementation(() => {
        throw new Error("inline read failed");
      });
      expect(readCssColor("--ws-color-primary")).toBe("#0F766E");
      expect(warning).toHaveBeenCalledWith(expect.stringContaining("could not read computed CSS token"));
      expect(warning).toHaveBeenCalledWith(expect.stringContaining("could not read inline CSS token"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("handles token cycles, depth limits, and nested explicit fallbacks without leaking expressions", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.documentElement.style.setProperty("--test-a", "var(--test-b)");
    document.documentElement.style.setProperty("--test-b", "var(--test-a)");
    expect(readCssColor("--test-a", "#112233")).toBe("#112233");
    document.documentElement.style.setProperty("--ws-color-primary", "var(--ws-color-primary)");
    expect(readCssColor("--ws-color-primary")).toBe("#0F766E");
    for (let index = 0; index < 10; index += 1) {
      document.documentElement.style.setProperty(`--test-depth-${index}`, `var(--test-depth-${index + 1})`);
    }
    expect(readCssColor("--test-depth-0", "#123456")).toBe("#123456");
    expect(resolveCssColor("var(--test-missing, var(--test-other, hsl(180 50% 50%)))")).toBe("hsl(180 50% 50%)");
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("cycle/depth limit"));
    // readCssToken is deliberately generic: non-color custom properties remain valid.
    document.documentElement.style.setProperty("--test-size", "42px");
    expect(readCssToken("--test-size")).toBe("42px");
  });

  it.each(["red", "rebeccapurple", "transparent", "auto", "inherit", "hsl(180 50% 50%)", "hsla(0.5turn, 50%, 50%, .4)"])(
    "retains supported live/literal color %j without a warning", (color) => {
      const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      document.documentElement.style.setProperty("--test-color", color);
      expect(readCssColor("--test-color")).toBe(color);
      expect(resolveCssColor(color)).toBe(color);
      expect(warning).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed HSL and named colors rather than accepting arbitrary live strings", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveCssColor("hsl(180px 50% 50%)", "#123456")).toBe("#123456");
    expect(resolveCssColor("hsl(180 50%junk 50%)", "#123456")).toBe("#123456");
    expect(resolveCssColor("not-a-color", "#123456")).toBe("#123456");
  });

  it("keeps external renderers free of unresolved var() and color-mix()", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const resolved = resolveEChartsOptionColors({
      color: ["var(--ws-color-primary-fill)", "var(--ws-color-brand-accent)"],
      tooltip: {
        backgroundColor: "var(--ws-color-surface)",
        borderColor: "var(--ws-color-border-control)",
        textStyle: { color: "var(--ws-color-text)" },
      },
      series: [
        {
          itemStyle: { color: "var(--ws-color-success-fill)" },
          areaStyle: { color: "color-mix(in srgb, #fff 50%, #000)" },
        },
      ],
    });

    const serialized = JSON.stringify(resolved);
    expect(serialized).not.toMatch(/\b(?:var|color-mix)\s*\(/i);
    expect(serialized).not.toContain("#000000");
    expect(resolved).toMatchObject({
      color: ["#0F766E", "#4F46E5"],
      tooltip: {
        backgroundColor: "#FFFFFF",
        borderColor: "rgba(15, 23, 42, 0.18)",
        textStyle: { color: "#0F172A" },
      },
    });
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it("preserves non-color content byte-for-byte, callbacks, and frozen input", () => {
    const content = [
      "讲解 var(--ws-color-primary)",
      "var(--ws-color-primary)",
      "说明 color-mix(in srgb, red, blue)",
      "变量 var(x)",
      "color-mix(in srgb, red, blue)",
      " \tVAR( --ws-color-primary )\r\n\u0000教学😀 ",
    ];
    const formatter = () => { throw new Error("formatter must not be called"); };
    const colorCallback = () => { throw new Error("color callback must not be called"); };
    const input = {
      title: { text: content[0], subtext: content[2], textStyle: { color: "var(--ws-color-text)" } },
      xAxis: {
        name: content[3],
        data: [...content, { value: content[4], textStyle: { color: "var(--ws-color-chart-axis)" } }],
        axisLabel: { formatter: content[5], color: "var(--ws-color-chart-axis)" },
      },
      legend: { formatter: content[1], data: content.map((name) => ({ name })) },
      tooltip: { formatter },
      series: [{
        type: "bar",
        name: content[3],
        data: [{ name: content[4], value: content, itemStyle: { color: colorCallback } }],
        label: { formatter, color: "var(--ws-color-text)" },
        lineStyle: { color: colorCallback },
      }],
    };
    const freeze = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    };
    freeze(input);
    const before = JSON.stringify(input);
    const resolved = resolveEChartsOptionColors(input);

    expect(resolved).not.toBe(input);
    expect(resolved.title.text).toBe(input.title.text);
    expect(resolved.title.subtext).toBe(input.title.subtext);
    expect(resolved.xAxis.name).toBe(input.xAxis.name);
    expect(resolved.xAxis.data.slice(0, content.length)).toEqual(content);
    expect(resolved.xAxis.data[content.length]).toEqual({ value: content[4], textStyle: { color: "#64748B" } });
    expect(resolved.xAxis.axisLabel.formatter).toBe(input.xAxis.axisLabel.formatter);
    expect(resolved.legend.data).toEqual(input.legend.data);
    expect(resolved.legend.formatter).toBe(input.legend.formatter);
    expect(resolved.series[0].name).toBe(input.series[0].name);
    expect(resolved.series[0].data[0].name).toBe(input.series[0].data[0].name);
    expect(resolved.series[0].data[0].value).toEqual(content);
    expect(resolved.series[0].data[0].itemStyle.color).toBe(colorCallback);
    expect(resolved.series[0].lineStyle.color).toBe(colorCallback);
    expect(resolved.series[0].label.formatter).toBe(formatter);
    expect(resolved.tooltip.formatter).toBe(formatter);
    expect(resolved.title.textStyle.color).toBe("#0F172A");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("does not treat raw data or non-plain objects as color options", () => {
    const token = "var(--ws-color-primary)";
    const raw = { color: token, borderColor: token, textShadowColor: token, name: token };
    const typedData = new Float32Array([1, 2, 3]);
    const input = {
      dataset: { source: [raw], dimensions: ["color", "name"] },
      series: [
        { data: [{ ...raw, value: raw, itemStyle: { color: token } }], encode: { color: token } },
        { data: typedData },
      ],
    };
    const resolved = resolveEChartsOptionColors(input);

    expect(resolved.dataset).toEqual(input.dataset);
    expect(resolved.series[0].encode).toEqual(input.series[0].encode);
    expect(resolved.series[0].data).toEqual([{ ...raw, value: raw, itemStyle: { color: "#0F766E" } }]);
    expect(resolved.series[1].data).toBe(typedData);
    expect(Array.from(typedData)).toEqual([1, 2, 3]);
    expect(raw.color).toBe(token);
  });

  it.each([
    " #AbCdEf \t",
    "transparent",
    "auto",
    "inherit",
    "rgba(10, 20, 30, 0.4)",
    "rgb(10 20 30 / 40%)",
    "hsl(180 50% 50%)",
  ])("keeps the fixed color literal %j unchanged", (color) => {
    const input = {
      color: [color],
      tooltip: { backgroundColor: color, borderColor: color, textStyle: { color } },
      series: [{ itemStyle: { color, shadowColor: color } }],
    };

    expect(resolveEChartsOptionColors(input)).toEqual(input);
  });
});
