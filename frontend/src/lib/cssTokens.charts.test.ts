import { describe, expect, it } from "vitest";
import { graphic } from "echarts";
import {
  alphaColor,
  cssColorFallbacks,
  readCssColor,
  resolveEChartsOptionColors,
} from "./cssTokens";

describe("chart color bridge", () => {
  it("exposes the eight registered chart palette fallbacks", () => {
    const palette = Array.from({ length: 8 }, (_, index) =>
      readCssColor(`--ws-color-chart-${index + 1}`),
    );

    expect(palette).toEqual([
      cssColorFallbacks["--ws-color-chart-1"],
      cssColorFallbacks["--ws-color-chart-2"],
      cssColorFallbacks["--ws-color-chart-3"],
      cssColorFallbacks["--ws-color-chart-4"],
      cssColorFallbacks["--ws-color-chart-5"],
      cssColorFallbacks["--ws-color-chart-6"],
      cssColorFallbacks["--ws-color-chart-7"],
      cssColorFallbacks["--ws-color-chart-8"],
    ]);
  });

  it("keeps chart series colors distinct from semantic status colors", () => {
    const chartPalette = Array.from({ length: 8 }, (_, index) =>
      cssColorFallbacks[`--ws-color-chart-${index + 1}`],
    );
    const statusColors = [
      cssColorFallbacks["--ws-color-info"],
      cssColorFallbacks["--ws-color-success"],
      cssColorFallbacks["--ws-color-warning"],
      cssColorFallbacks["--ws-color-error"],
    ];
    const teacherAnnotation = cssColorFallbacks["--ws-color-chart-annotation-teacher"];

    expect(new Set(chartPalette).size).toBe(chartPalette.length);
    expect(chartPalette.some((color) => statusColors.includes(color))).toBe(false);
    expect(statusColors).not.toContain(teacherAnnotation);
    expect(chartPalette).not.toContain(teacherAnnotation);
  });

  it("resolves chart option colors without unresolved CSS expressions", () => {
    const option = resolveEChartsOptionColors({
      color: ["var(--ws-color-chart-1)", "var(--ws-color-chart-2)"],
      backgroundColor: "var(--ws-color-chart-surface)",
      legend: { textStyle: { color: "var(--ws-color-chart-axis)" } },
      tooltip: {
        backgroundColor: "var(--ws-color-chart-tooltip)",
        borderColor: "var(--ws-color-chart-grid)",
        textStyle: { color: "var(--ws-color-chart-tooltip-text)" },
      },
      series: [
        {
          itemStyle: { color: "var(--ws-color-chart-3)" },
          areaStyle: { color: "var(--ws-color-chart-4)" },
          emphasis: { itemStyle: { shadowColor: "var(--ws-color-chart-5)" } },
        },
      ],
    });
    const serialized = JSON.stringify(option);

    expect(serialized).not.toMatch(/\b(?:var|color-mix)\s*\(/i);
    expect(option).toMatchObject({
      color: ["#0F766E", "#4F46E5"],
      backgroundColor: "#FFFFFF",
      legend: { textStyle: { color: "#64748B" } },
      series: [{ itemStyle: { color: "#1D4ED8" } }],
    });
  });

  it("multiplies alpha when projecting translucent chart colors", () => {
    expect(alphaColor("rgba(15, 118, 110, 0.8)", 0.25)).toBe("rgba(15, 118, 110, 0.2)");
    expect(alphaColor("var(--ws-color-chart-grid)", 0.5)).toBe("rgba(15, 23, 42, 0.05)");
  });

  it("projects palette, radar, visualMap, gradient, and text/border/shadow color slots", () => {
    const primary = "var(--ws-color-chart-1)";
    const secondary = "var(--ws-color-chart-2)";
    const category = "变量 var(--ws-color-chart-1)";
    const gradient = {
      type: "linear", x: 0, y: 0, x2: 1, y2: 1, global: false,
      colorStops: [{ offset: 0, color: primary }, { offset: 1, color: secondary }],
      name: category,
    };
    const input = {
      color: [primary, secondary],
      radar: {
        indicator: [{ name: category, max: 100 }],
        axisName: { color: primary },
        splitLine: { lineStyle: { color: [primary, secondary] } },
        splitArea: { areaStyle: { color: [primary, secondary] } },
      },
      visualMap: [{
        categories: [category],
        inRange: { color: { [category]: primary, second: [primary, secondary] }, symbol: category },
        outOfRange: { color: [secondary], opacity: [0, 0.5] },
        pieces: [{ value: category, label: category, color: secondary }],
        text: [category, category],
      }],
      title: { text: category, textStyle: {
        color: primary, textBorderColor: secondary, textShadowColor: primary,
        rich: { emphasis: { color: secondary, backgroundColor: primary, borderColor: secondary, shadowColor: primary } },
      } },
      series: [{
        itemStyle: { color: gradient, borderColor: secondary, shadowColor: primary },
        areaStyle: { color: { type: "radial", x: 0.5, y: 0.5, r: 0.5, colorStops: [{ offset: 0, color: secondary }] } },
        emphasis: { label: { color: secondary, textBorderColor: primary, textShadowColor: secondary } },
      }],
    };
    const before = JSON.stringify(input);
    const resolved = resolveEChartsOptionColors(input);

    expect(resolved.color).toEqual(["#0F766E", "#4F46E5"]);
    expect(resolved.radar.indicator).toEqual(input.radar.indicator);
    expect(resolved.radar.axisName.color).toBe("#0F766E");
    expect(resolved.radar.splitLine.lineStyle.color).toEqual(["#0F766E", "#4F46E5"]);
    expect(resolved.radar.splitArea.areaStyle.color).toEqual(["#0F766E", "#4F46E5"]);
    expect(resolved.visualMap[0].inRange.color).toEqual({ [category]: "#0F766E", second: ["#0F766E", "#4F46E5"] });
    expect(resolved.visualMap[0].inRange.symbol).toBe(category);
    expect(resolved.visualMap[0].outOfRange).toEqual({ color: ["#4F46E5"], opacity: [0, 0.5] });
    expect(resolved.visualMap[0].categories).toEqual([category]);
    expect(resolved.visualMap[0].text).toEqual([category, category]);
    expect(resolved.visualMap[0].pieces).toEqual([{ value: category, label: category, color: "#4F46E5" }]);
    expect(resolved.title.text).toBe(category);
    expect(resolved.title.textStyle).toEqual({
      color: "#0F766E", textBorderColor: "#4F46E5", textShadowColor: "#0F766E",
      rich: { emphasis: { color: "#4F46E5", backgroundColor: "#0F766E", borderColor: "#4F46E5", shadowColor: "#0F766E" } },
    });
    expect(resolved.series[0].itemStyle).toEqual({
      color: { ...gradient, colorStops: [{ offset: 0, color: "#0F766E" }, { offset: 1, color: "#4F46E5" }] },
      borderColor: "#4F46E5", shadowColor: "#0F766E",
    });
    expect(resolved.series[0].areaStyle.color).toEqual({ type: "radial", x: 0.5, y: 0.5, r: 0.5, colorStops: [{ offset: 0, color: "#4F46E5" }] });
    expect(resolved.series[0].emphasis.label).toEqual({ color: "#4F46E5", textBorderColor: "#0F766E", textShadowColor: "#4F46E5" });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("resolves real ECharts gradient instances without mutating their color stops", () => {
    const gradient = new graphic.LinearGradient(0, 0, 1, 1, [
      { offset: 0, color: "var(--ws-color-chart-1)" },
      { offset: 1, color: "var(--ws-color-chart-2)" },
    ]);
    const radial = new graphic.RadialGradient(0.5, 0.5, 0.5, [
      { offset: 0, color: "var(--ws-color-chart-2)" },
    ]);
    const before = JSON.stringify([gradient, radial]);
    const resolved = resolveEChartsOptionColors({
      series: [{ itemStyle: { color: gradient }, areaStyle: { color: radial } }],
    });

    expect(resolved.series[0].itemStyle.color).not.toBe(gradient);
    expect(resolved.series[0].itemStyle.color).toMatchObject({
      type: "linear", x: 0, y: 0, x2: 1, y2: 1,
      colorStops: [{ offset: 0, color: "#0F766E" }, { offset: 1, color: "#4F46E5" }],
    });
    expect(resolved.series[0].areaStyle.color).toMatchObject({
      type: "radial", x: 0.5, y: 0.5, r: 0.5,
      colorStops: [{ offset: 0, color: "#4F46E5" }],
    });
    expect(JSON.stringify([gradient, radial])).toBe(before);
  });

  it("treats arbitrary rich-text style names as style contexts, not raw data keys", () => {
    const names = ["data", "value", "dataset", "source", "dimensions", "encode", "categories", "nodes", "links", "edges", "info"];
    const input = { series: [{ label: {
      formatter: "{value|var(--ws-color-primary)}",
      rich: Object.fromEntries(names.map((name) => [name, {
        color: "var(--ws-color-chart-1)", textShadowColor: "var(--ws-color-chart-2)",
      }])),
    } }] };
    const resolved = resolveEChartsOptionColors(input);

    expect(resolved.series[0].label.formatter).toBe(input.series[0].label.formatter);
    expect(resolved.series[0].label.rich).toEqual(Object.fromEntries(names.map((name) => [name, {
      color: "#0F766E", textShadowColor: "#4F46E5",
    }])));
    expect(input.series[0].label.rich.value.color).toBe("var(--ws-color-chart-1)");
  });

  it("protects graph payload colors and graphic info while projecting nested styles", () => {
    const token = "var(--ws-color-chart-1)";
    const callback = () => "keep identity";
    const input = {
      series: [{
        type: "graph",
        nodes: [{
          name: "node",
          color: token,
          itemStyle: { color: token },
          label: { color: token, formatter: callback },
        }],
        links: [{
          source: "node",
          target: "other",
          color: token,
          lineStyle: { color: token },
          emphasis: { itemStyle: { color: token } },
        }],
        edges: [{
          source: "other",
          target: "node",
          color: token,
          lineStyle: { color: token },
        }],
      }],
      graphic: [{
        type: "rect",
        info: { color: token, nested: { color: token } },
      }],
    };

    const resolved = resolveEChartsOptionColors(input);

    expect(resolved.series[0].nodes[0].color).toBe(token);
    expect(resolved.series[0].nodes[0].itemStyle.color).toBe("#0F766E");
    expect(resolved.series[0].nodes[0].label.color).toBe("#0F766E");
    expect(resolved.series[0].nodes[0].label.formatter).toBe(callback);
    expect(resolved.series[0].links[0].color).toBe(token);
    expect(resolved.series[0].links[0].lineStyle.color).toBe("#0F766E");
    expect(resolved.series[0].links[0].emphasis.itemStyle.color).toBe("#0F766E");
    expect(resolved.series[0].edges[0].color).toBe(token);
    expect(resolved.series[0].edges[0].lineStyle.color).toBe("#0F766E");
    expect(resolved.graphic[0].info).toEqual(input.graphic[0].info);
    expect(input.series[0].nodes[0].color).toBe(token);
  });

  it.each(["nodes", "links", "edges"] as const)("protects %s payloads without disabling their style projection", (key) => {
    const token = "var(--ws-color-chart-1)";
    const payload = { color: token, nested: { color: token } };
    const callback = () => { throw new Error("callback must not run"); };
    const datum = {
      color: token, payload, children: [payload],
      itemStyle: { color: token, borderColor: token },
      lineStyle: { color: token },
      label: { color: token, formatter: callback },
      select: { lineStyle: { color: token } },
    };
    const dataByKey: Partial<Record<typeof key, Array<typeof datum>>> = { [key]: [datum] };
    const input = { series: [{ type: "graph", ...dataByKey }] };
    const before = JSON.stringify(input);
    const resolved = resolveEChartsOptionColors(input);
    const item = resolved.series[0][key]![0];
    expect(item.color).toBe(token);
    expect(item.payload).toBe(payload);
    expect(item.children).toEqual([payload]);
    expect(item.itemStyle).toEqual({ color: "#0F766E", borderColor: "#0F766E" });
    expect(item.lineStyle.color).toBe("#0F766E");
    expect(item.label.color).toBe("#0F766E");
    expect(item.label.formatter).toBe(callback);
    expect(item.select.lineStyle.color).toBe("#0F766E");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("keeps graphic info opaque, including cyclic content, without skipping adjacent color slots", () => {
    const token = "var(--ws-color-chart-1)";
    const info: { color: string; nested: { color: string }; self?: unknown } = { color: token, nested: { color: token } };
    info.self = info;
    const resolved = resolveEChartsOptionColors({ graphic: [{
      type: "text", info, style: { text: token, color: token, backgroundColor: token },
    }] });
    expect(resolved.graphic[0].info).toBe(info);
    expect(resolved.graphic[0].info.self).toBe(info);
    expect(resolved.graphic[0].style).toEqual({ text: token, color: "#0F766E", backgroundColor: "#0F766E" });
    expect(info.color).toBe(token);
  });
});
