import { afterEach, describe, expect, it, vi } from "vitest";
import { getWangShMermaidTheme } from "./mermaidTheme";

const token = (name: string, value: string) => document.documentElement.style.setProperty(`--ws-color-${name}`, value);

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("style");
});

describe("WangSh Mermaid theme", () => {
  it("uses the customizable base theme, strict security and only HEX6 variables", () => {
    const config = getWangShMermaidTheme();
    expect(config).toMatchObject({ theme: "base", securityLevel: "strict", startOnLoad: false });
    expect(Object.keys(config.themeVariables).length).toBeGreaterThanOrEqual(30);
    Object.values(config.themeVariables).forEach((value) => expect(value).toMatch(/^#[0-9A-F]{6}$/));
  });

  it("suppresses the runtime error diagram so BookReader owns the safe error fallback", () => {
    expect(getWangShMermaidTheme().suppressErrorRendering).toBe(true);
  });

  it("resolves live aliases, short HEX and rgb for nodes, edges, labels and clusters", () => {
    document.documentElement.style.setProperty("--test-node", "#abc");
    token("diagram-node-fill", "var(--test-node)");
    token("diagram-node-border", "rgb(20, 30, 40)");
    token("diagram-text", "#123");
    token("diagram-edge", "rgb(50 60 70)");
    token("surface-2", "#cde");
    token("primary-muted", "#def");
    token("primary-text", "rgb(10, 80, 50)");
    token("focus-ring", "#13579b");
    const variables = getWangShMermaidTheme().themeVariables;
    expect(variables).toMatchObject({
      primaryColor: "#AABBCC", mainBkg: "#AABBCC", actorBkg: "#AABBCC",
      primaryBorderColor: "#141E28", nodeBorder: "#141E28", actorBorder: "#141E28",
      nodeTextColor: "#112233", primaryTextColor: "#112233", textColor: "#112233",
      lineColor: "#323C46", defaultLinkColor: "#323C46", arrowheadColor: "#323C46", signalColor: "#323C46",
      edgeLabelBackground: "#CCDDEE", clusterBkg: "#CCDDEE", clusterBorder: "#141E28",
      noteBkgColor: "#DDEEFF", noteTextColor: "#0A5032", tertiaryBorderColor: "#13579B",
    });
  });

  it("projects alpha onto the actual surface and canvas before rounding to HEX6", () => {
    token("surface", "rgb(240 240 240)");
    token("diagram-canvas", "rgb(20 40 60 / 50%)");
    token("diagram-node-fill", "rgba(200, 10, 40, 0.5)");
    token("surface-2", "rgba(10, 60, 250, 0.25)");
    token("primary-muted", "#0000");
    const variables = getWangShMermaidTheme().themeVariables;
    expect(variables.background).toBe("#828C96");
    expect(variables.primaryColor).toBe("#A54B5F");
    expect(variables.edgeLabelBackground).toBe("#6478AF");
    expect(variables.noteBkgColor).toBe("#828C96");
    token("diagram-node-fill", "#12345680");
    expect(getWangShMermaidTheme().themeVariables.primaryColor).toBe("#4A6076");
  });

  it("re-reads current tokens and never shares a mutable initialization object", () => {
    token("diagram-edge", "#102030");
    const first = getWangShMermaidTheme();
    first.themeVariables.primaryColor = "#000000";
    token("diagram-edge", "#405060");
    const second = getWangShMermaidTheme();
    expect(second.themeVariables.lineColor).toBe("#405060");
    expect(first.themeVariables.lineColor).toBe("#102030");
    expect(second.themeVariables.primaryColor).not.toBe("#000000");
    expect(first).not.toBe(second);
    expect(first.themeVariables).not.toBe(second.themeVariables);
  });

  it("uses the registered shared fallbacks without DOM access in SSR", () => {
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("window", undefined);
    const variables = getWangShMermaidTheme().themeVariables;
    expect(variables.primaryColor).toBeTruthy();
    Object.values(variables).forEach((value) => expect(value).toMatch(/^#[0-9A-F]{6}$/));
  });
});
