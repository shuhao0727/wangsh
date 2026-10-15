import { parseColor, readCssColor } from "./cssTokens";

/** Mermaid's customizable base theme accepts HEX colors, not CSS variables. */
export type WangShMermaidTheme = {
  theme: "base";
  securityLevel: "strict";
  startOnLoad: false;
  suppressErrorRendering: true;
  themeVariables: Record<string, string>;
};

export function getWangShMermaidTheme(): WangShMermaidTheme {
  const read = (token: string) => {
    const color = parseColor(readCssColor(token));
    if (!color) throw new Error(`Mermaid 主题颜色无法解析：${token}`);
    return color;
  };
  type Color = NonNullable<ReturnType<typeof parseColor>>;
  const composite = (foreground: Color, background: Color): Color => ({
    red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
    green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
    blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
    alpha: 1,
  });
  // HEX6 cannot carry opacity. Project translucent tokens onto the actual light canvas.
  const canvas = composite(read("--ws-color-diagram-canvas"), read("--ws-color-surface"));
  const hex = (color: Color) => "#" + [color.red, color.green, color.blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("").toUpperCase();
  const color = (token: string) => hex(composite(read(token), canvas));
  const node = color("--ws-color-diagram-node-fill");
  const border = color("--ws-color-diagram-node-border");
  const text = color("--ws-color-diagram-text");
  const edge = color("--ws-color-diagram-edge");
  const secondary = color("--ws-color-surface-2");
  const muted = color("--ws-color-primary-muted");
  const primaryText = color("--ws-color-primary-text");
  const focus = color("--ws-color-focus-ring");

  return {
    theme: "base",
    securityLevel: "strict",
    startOnLoad: false,
    suppressErrorRendering: true,
    themeVariables: {
      background: hex(canvas),
      primaryColor: node,
      primaryTextColor: text,
      primaryBorderColor: border,
      secondaryColor: secondary,
      secondaryTextColor: text,
      secondaryBorderColor: border,
      tertiaryColor: muted,
      tertiaryTextColor: primaryText,
      tertiaryBorderColor: focus,
      mainBkg: node,
      nodeBorder: border,
      nodeTextColor: text,
      textColor: text,
      titleColor: text,
      lineColor: edge,
      defaultLinkColor: edge,
      arrowheadColor: edge,
      edgeLabelBackground: secondary,
      clusterBkg: secondary,
      clusterBorder: border,
      noteBkgColor: muted,
      noteTextColor: primaryText,
      noteBorderColor: border,
      actorBkg: node,
      actorTextColor: text,
      actorBorder: border,
      actorLineColor: edge,
      signalColor: edge,
      signalTextColor: text,
      labelBoxBkgColor: secondary,
      labelBoxBorderColor: border,
      labelTextColor: text,
      loopTextColor: text,
      activationBkgColor: muted,
      activationBorderColor: border,
    },
  };
}
