/**
 * CSS token -> concrete color bridge.
 *
 * CSS variables are valid for DOM styles, but canvas/SVG runtimes such as
 * ECharts cannot consume `var(--ws-...)` directly. This module keeps the
 * browser resolver, SSR/test fallback, and alpha conversion in one place.
 * The concrete fallback values mirror the :root contract in styles/index.css;
 * the stylesheet remains the source of truth in a browser.
 */

const MAX_VAR_RESOLUTION_DEPTH = 8;
const UNRESOLVED_COLOR_EXPRESSION = /\b(?:var|color-mix)\s*\(/i;
const SAFE_COLOR_FALLBACK = "#0F172A";

const COLOR_FALLBACKS: Record<string, string> = {
  "--ws-color-page": "#F8FBFC",
  "--ws-color-bg": "#F8FBFC",
  "--ws-color-surface": "#FFFFFF",
  "--ws-color-surface-2": "#F4F8F9",
  "--ws-color-text": "#0F172A",
  "--ws-color-text-secondary": "#334155",
  "--ws-color-text-tertiary": "#64748B",
  "--ws-color-text-placeholder": "#64748B",
  "--ws-color-text-inverse": "#FFFFFF",
  "--ws-color-border": "rgba(15, 23, 42, 0.12)",
  "--ws-color-border-subtle": "rgba(15, 23, 42, 0.12)",
  "--ws-color-border-control": "rgba(15, 23, 42, 0.18)",
  "--ws-color-border-strong": "rgba(15, 23, 42, 0.28)",
  "--ws-color-border-secondary": "rgba(15, 23, 42, 0.12)",
  "--ws-color-primary": "#0F766E",
  "--ws-color-primary-fill": "#0F766E",
  "--ws-color-primary-hover": "#0B5F59",
  "--ws-color-primary-active": "#084C47",
  "--ws-color-primary-text": "#0F766E",
  "--ws-color-primary-border": "#0F766E",
  "--ws-color-primary-soft": "rgba(15, 118, 110, 0.08)",
  "--ws-color-primary-muted": "#E6F7F5",
  "--ws-color-secondary": "#4F46E5",
  "--ws-color-accent": "#4F46E5",
  "--ws-color-brand-accent": "#4F46E5",
  "--ws-color-brand-accent-hover": "#4338CA",
  "--ws-color-brand-accent-active": "#3730A3",
  "--ws-color-brand-accent-text": "#4338CA",
  "--ws-color-brand-accent-border": "#4F46E5",
  "--ws-color-brand-accent-soft": "rgba(79, 70, 229, 0.08)",
  "--ws-color-hover-bg": "rgba(15, 118, 110, 0.07)",
  "--ws-color-focus-ring": "#4F46E5",
  "--ws-color-interaction-hover": "rgba(15, 118, 110, 0.07)",
  "--ws-color-interaction-focus": "#4F46E5",
  "--ws-color-interaction-selected": "rgba(79, 70, 229, 0.08)",
  "--ws-color-interaction-disabled": "rgba(15, 23, 42, 0.04)",
  "--ws-color-interaction-disabled-text": "#64748B",
  "--ws-color-interaction-loading": "rgba(15, 118, 110, 0.14)",
  "--ws-color-success": "#15803D",
  "--ws-color-success-fill": "#15803D",
  "--ws-color-success-text": "#15803D",
  "--ws-color-success-border": "#15803D",
  "--ws-color-success-soft": "rgba(21, 128, 61, 0.08)",
  "--ws-color-warning": "#B45309",
  "--ws-color-warning-fill": "#B45309",
  "--ws-color-warning-text": "#B45309",
  "--ws-color-warning-border": "#B45309",
  "--ws-color-warning-soft": "rgba(180, 83, 9, 0.08)",
  "--ws-color-error": "#B42318",
  "--ws-color-danger": "#B42318",
  "--ws-color-error-fill": "#B42318",
  "--ws-color-error-text": "#B42318",
  "--ws-color-error-border": "#B42318",
  "--ws-color-error-soft": "rgba(180, 35, 24, 0.08)",
  "--ws-color-info": "#0369A1",
  "--ws-color-info-fill": "#0369A1",
  "--ws-color-info-text": "#0369A1",
  "--ws-color-info-border": "#0369A1",
  "--ws-color-info-soft": "rgba(3, 105, 161, 0.08)",
  "--ws-color-chart-1": "#0F766E",
  "--ws-color-chart-2": "#4F46E5",
  "--ws-color-chart-3": "#1D4ED8",
  "--ws-color-chart-4": "#C2410C",
  "--ws-color-chart-5": "#4D7C0F",
  "--ws-color-chart-6": "#BE185D",
  "--ws-color-chart-7": "#0E7490",
  "--ws-color-chart-8": "#7C3AED",
  "--ws-color-chart-annotation-teacher": "#7E22CE",
  "--ws-color-chart-axis": "#64748B",
  "--ws-color-chart-grid": "rgba(15, 23, 42, 0.10)",
  "--ws-color-chart-surface": "#FFFFFF",
  "--ws-color-chart-tooltip": "#FFFFFF",
  "--ws-color-chart-tooltip-text": "#0F172A",
  "--ws-color-module-shell": "#FFFFFF",
  "--ws-color-module-shell-surface": "#FFFFFF",
  "--ws-color-module-shell-surface-2": "#F4F8F9",
  "--ws-color-module-shell-border": "rgba(15, 23, 42, 0.18)",
  "--ws-color-module-shell-text": "#0F172A",
  "--ws-color-module-shell-muted": "#334155",
  "--ws-color-module-shell-accent": "#0F766E",
  "--ws-color-module-shell-focus": "#4F46E5",
  "--ws-color-module-shell-hover": "rgba(15, 118, 110, 0.07)",
  "--ws-color-module-shell-selected": "rgba(79, 70, 229, 0.08)",
  "--ws-color-module-shell-input": "#FFFFFF",
  "--ws-color-module-shell-canvas": "#FFFFFF",
  "--ws-color-module-shell-code": "#1E1E1E",
  "--ws-color-module-shell-code-text": "#D4D4D4",
  "--ws-color-diagram-canvas": "#FFFFFF",
  "--ws-color-diagram-node-fill": "#FFFFFF",
  "--ws-color-diagram-node-border": "#64748B",
  "--ws-color-diagram-text": "#0F172A",
  "--ws-color-diagram-edge": "#334155",
  "--ws-color-diagram-selected": "#4F46E5",
  "--ws-color-diagram-active": "#0E7490",
  "--ws-color-diagram-active-fill": "rgba(14, 116, 144, 0.12)",
  "--ws-color-diagram-note-fill": "#E6F7F5",
  "--ws-color-diagram-note-border": "#64748B",
  "--ws-color-diagram-note-edge": "#334155",
  "--ws-color-diagram-handle-fill": "#FFFFFF",
  "--ws-color-diagram-control": "#4F46E5",
  "--ws-color-diagram-follow": "#0E7490",
  "--ws-color-diagram-breakpoint": "#9333EA",
  "--ws-color-debug-idle": "#334155",
  "--ws-color-debug-idle-soft": "#F4F8F9",
  "--ws-color-debug-starting": "#0369A1",
  "--ws-color-debug-starting-soft": "rgba(3, 105, 161, 0.08)",
  "--ws-color-debug-running": "#0369A1",
  "--ws-color-debug-running-soft": "rgba(3, 105, 161, 0.08)",
  "--ws-color-debug-paused": "#B45309",
  "--ws-color-debug-paused-soft": "rgba(180, 83, 9, 0.08)",
  "--ws-color-debug-stopped": "#334155",
  "--ws-color-debug-stopped-soft": "#F4F8F9",
  "--ws-color-debug-error": "#B42318",
  "--ws-color-debug-error-soft": "rgba(180, 35, 24, 0.08)",
  "--ws-color-debug-mismatch": "#B45309",
  "--ws-color-debug-mismatch-soft": "rgba(180, 83, 9, 0.08)",
  "--ws-color-terminal-background": "#FFFFFF",
  "--ws-color-terminal-foreground": "#0F172A",
  "--ws-color-terminal-cursor": "#3730A3",
  "--ws-color-terminal-cursor-accent": "#FFFFFF",
  "--ws-color-terminal-selection": "rgba(79, 70, 229, 0.20)",
  "--ws-color-terminal-selection-inactive": "rgba(79, 70, 229, 0.12)",
  "--ws-color-terminal-selection-foreground": "#0F172A",
  "--ws-color-terminal-gutter-background": "#F4F8F9",
  "--ws-color-terminal-gutter-text": "#334155",
  "--ws-color-terminal-gutter-border": "rgba(15, 23, 42, 0.12)",
  "--ws-color-terminal-scrollbar": "rgba(15, 23, 42, 0.28)",
  "--ws-color-terminal-scrollbar-hover": "rgba(15, 23, 42, 0.40)",
  "--ws-color-terminal-scrollbar-track": "#F4F8F9",
  "--ws-color-terminal-black": "#0F172A",
  "--ws-color-terminal-red": "#B42318",
  "--ws-color-terminal-green": "#15803D",
  "--ws-color-terminal-yellow": "#B45309",
  "--ws-color-terminal-blue": "#0369A1",
  "--ws-color-terminal-magenta": "#9D174D",
  "--ws-color-terminal-cyan": "#0E7490",
  "--ws-color-terminal-white": "#334155",
  "--ws-color-terminal-bright-black": "#475569",
  "--ws-color-terminal-bright-red": "#991B1B",
  "--ws-color-terminal-bright-green": "#166534",
  "--ws-color-terminal-bright-yellow": "#92400E",
  "--ws-color-terminal-bright-blue": "#1D4ED8",
  "--ws-color-terminal-bright-magenta": "#7C3AED",
  "--ws-color-terminal-bright-cyan": "#0F766E",
  "--ws-color-terminal-bright-white": "#0F172A",
  "--ws-color-editor-background": "#FFFFFF",
  "--ws-color-editor-foreground": "#0F172A",
  "--ws-color-editor-gutter-background": "#F4F8F9",
  "--ws-color-editor-gutter-border": "rgba(15, 23, 42, 0.12)",
  "--ws-color-editor-line-number": "#64748B",
  "--ws-color-editor-line-number-active": "#4338CA",
  "--ws-color-editor-current-line": "rgba(79, 70, 229, 0.06)",
  "--ws-color-editor-execution-line": "rgba(14, 116, 144, 0.12)",
  "--ws-color-editor-execution-gutter": "#0E7490",
  "--ws-color-editor-selection": "rgba(79, 70, 229, 0.20)",
  "--ws-color-editor-selection-inactive": "rgba(79, 70, 229, 0.10)",
  "--ws-color-editor-cursor": "#3730A3",
  "--ws-color-editor-bracket-match": "rgba(79, 70, 229, 0.14)",
  "--ws-color-editor-bracket-match-border": "#4F46E5",
  "--ws-color-editor-hover": "#F4F8F9",
  "--ws-color-editor-hover-border": "rgba(15, 23, 42, 0.18)",
  "--ws-color-editor-suggest": "#FFFFFF",
  "--ws-color-editor-suggest-selected": "rgba(79, 70, 229, 0.12)",
  "--ws-color-editor-find-match": "rgba(194, 65, 12, 0.18)",
  "--ws-color-editor-find-match-selected": "rgba(194, 65, 12, 0.28)",
  "--ws-color-editor-scrollbar": "rgba(15, 23, 42, 0.18)",
  "--ws-color-editor-scrollbar-hover": "rgba(15, 23, 42, 0.28)",
  "--ws-color-editor-scrollbar-active": "rgba(15, 23, 42, 0.36)",
  "--ws-color-editor-minimap-background": "#F4F8F9",
  "--ws-color-editor-minimap-selection": "rgba(79, 70, 229, 0.16)",
  "--ws-color-editor-error": "#B42318",
  "--ws-color-editor-warning": "#B45309",
  "--ws-color-editor-info": "#0369A1",
  "--ws-color-editor-breakpoint": "#9333EA",
  "--ws-color-editor-breakpoint-disabled": "rgba(147, 51, 234, 0.44)",
  "--ws-color-editor-diff-added": "#166534",
  "--ws-color-editor-diff-added-background": "rgba(22, 101, 52, 0.14)",
  "--ws-color-editor-diff-removed": "#B91C1C",
  "--ws-color-editor-diff-removed-background": "rgba(185, 28, 28, 0.13)",
  "--ws-color-editor-diff-modified": "#4338CA",
  "--ws-color-editor-diff-modified-background": "rgba(67, 56, 202, 0.13)",
  "--ws-color-editor-diff-unchanged": "#64748B",
  "--ws-color-editor-diff-unchanged-background": "rgba(100, 116, 139, 0.08)",
  "--ws-color-editor-syntax-keyword": "#6D28D9",
  "--ws-color-editor-syntax-string": "#047857",
  "--ws-color-editor-syntax-number": "#9A3412",
  "--ws-color-editor-syntax-comment": "#64748B",
  "--ws-color-editor-syntax-function": "#0369A1",
  "--ws-color-editor-syntax-type": "#0F766E",
  "--ws-color-editor-syntax-decorator": "#9D174D",
  "--ws-color-editor-syntax-operator": "#334155",
  "--ws-color-editor-syntax-variable": "#0F172A",
};

const normalizeTokenName = (name: string) => (name.trim().startsWith("--") ? name.trim() : `--${name.trim()}`);

const readRawCssToken = (name: string): string => {
  if (typeof document === "undefined" || !document.documentElement) return "";
  const root = document.documentElement;
  try {
    const computed = getComputedStyle(root).getPropertyValue(name).trim();
    if (computed) return computed;
  } catch {
    reportResolutionIssue(`could not read computed CSS token ${name}; trying inline/fallback`);
  }
  try {
    return root.style.getPropertyValue(name).trim();
  } catch {
    reportResolutionIssue(`could not read inline CSS token ${name}; using fallback`);
    return "";
  }
};

const unwrapVar = (value: string): { name: string; fallback?: string } | null => {
  const match = value.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/);
  return match ? { name: match[1], fallback: match[2]?.trim() } : null;
};

const reportResolutionIssue = (message: string): void => {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[cssTokens] ${message}`);
  }
};

const clampAlpha = (alpha: number): number => (Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0);

const safeConcreteFallback = (fallback: string): string => {
  const candidate = fallback.trim();
  if (isConcreteColor(candidate)) return candidate;
  if (candidate) reportResolutionIssue(`invalid color fallback ${candidate}; using ${SAFE_COLOR_FALLBACK}`);
  return SAFE_COLOR_FALLBACK;
};

const resolveTokenValue = (name: string, fallback: string, stack: Set<string>, depth: number): string => {
  const tokenName = normalizeTokenName(name);
  const registeredFallback = COLOR_FALLBACKS[tokenName] || "";
  const fallbackValue = fallback.trim() || registeredFallback;

  if (depth >= MAX_VAR_RESOLUTION_DEPTH) {
    reportResolutionIssue(`token resolution exceeded ${MAX_VAR_RESOLUTION_DEPTH} levels for ${tokenName}`);
    return fallbackValue && !UNRESOLVED_COLOR_EXPRESSION.test(fallbackValue) ? fallbackValue : "";
  }
  if (stack.has(tokenName)) {
    reportResolutionIssue(`token cycle detected while resolving ${tokenName}`);
    return fallbackValue && !UNRESOLVED_COLOR_EXPRESSION.test(fallbackValue) ? fallbackValue : "";
  }

  const value = readRawCssToken(tokenName) || fallbackValue;
  if (!value) return "";
  const reference = unwrapVar(value);
  if (!reference) return value;

  const nextStack = new Set(stack);
  nextStack.add(tokenName);
  const referenceFallback = reference.fallback || COLOR_FALLBACKS[reference.name] || fallbackValue;
  return resolveTokenValue(reference.name, referenceFallback, nextStack, depth + 1);
};

/** Resolve whole-value var() aliases; other raw custom-property strings stay intact. */
export const readCssToken = (name: string, fallback = ""): string =>
  resolveTokenValue(normalizeTokenName(name), fallback, new Set<string>(), 0);

const CSS_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;
const parseNumber = (value: string): number | null => {
  if (!CSS_NUMBER.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseChannel = (value: string): number | null => {
  const percentage = value.endsWith("%");
  const channel = parseNumber(percentage ? value.slice(0, -1) : value);
  if (channel === null) return null;
  return percentage ? Math.round(Math.max(0, Math.min(100, channel)) * 255 / 100)
    : Math.round(Math.max(0, Math.min(255, channel)));
};

const parseAlpha = (value: string): number | null => {
  const percentage = value.endsWith("%");
  const alpha = parseNumber(percentage ? value.slice(0, -1) : value);
  return alpha === null ? null : clampAlpha(percentage ? alpha / 100 : alpha);
};

// Comma syntax cannot be mixed with slash syntax or a fourth space channel.
const parseFunctionParts = (body: string): { channels: string[]; alpha?: string; legacy: boolean } | null => {
  if (body.includes(",")) {
    if (body.includes("/")) return null;
    const parts = body.split(",").map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) return null;
    return { channels: parts.slice(0, 3), alpha: parts[3], legacy: true };
  }
  const parts = body.split("/").map((part) => part.trim());
  const channels = parts[0].split(/\s+/);
  if (parts.length > 2 || channels.length !== 3) return null;
  return { channels, alpha: parts[1], legacy: false };
};

export type ParsedColor = { red: number; green: number; blue: number; alpha: number };

export const parseColor = (color: string): ParsedColor | null => {
  const value = color.trim();
  if (value.toLowerCase() === "transparent") return { red: 0, green: 0, blue: 0, alpha: 0 };

  const hex = value.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? hex.split("").map((part) => part + part).join("") : hex;
    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);
    const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
    return { red, green, blue, alpha };
  }

  const rgbMatch = value.match(/^rgba?\(\s*(.*?)\s*\)$/i);
  if (!rgbMatch) return null;
  const parts = parseFunctionParts(rgbMatch[1].trim());
  if (!parts) return null;
  const percentages = parts.channels.filter((part) => part.endsWith("%")).length;
  if (parts.legacy && percentages !== 0 && percentages !== 3) return null;
  const red = parseChannel(parts.channels[0]);
  const green = parseChannel(parts.channels[1]);
  const blue = parseChannel(parts.channels[2]);
  const alpha = parts.alpha === undefined ? 1 : parseAlpha(parts.alpha);
  if (red === null || green === null || blue === null || alpha === null) return null;
  return { red, green, blue, alpha };
};

export const formatRgba = ({ red, green, blue, alpha }: ParsedColor): string =>
  `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(4))})`;

// Keep validation deterministic in SSR; no DOM probe or renderer dependency.
const NAMED_COLORS = new Set((
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood " +
  "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey " +
  "darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey " +
  "darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite " +
  "gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon " +
  "lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue " +
  "lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid " +
  "mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin " +
  "navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff " +
  "peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver " +
  "skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
).split(" "));

const isConcreteColor = (value: string): boolean => {
  if (parseColor(value) || NAMED_COLORS.has(value.toLowerCase())) return true;
  // ECharts color-slot sentinels are part of the bridge contract.
  if (value === "auto" || value === "inherit") return true;
  const hsl = value.match(/^hsla?\(\s*(.*?)\s*\)$/i);
  const parts = hsl && parseFunctionParts(hsl[1].trim());
  if (!parts) return false;
  const hue = parts.channels[0].replace(/(?:deg|grad|rad|turn)$/i, "");
  return parseNumber(hue) !== null && parts.channels.slice(1).every((part) =>
    part.endsWith("%") && parseNumber(part.slice(0, -1)) !== null,
  ) && (parts.alpha === undefined || parseAlpha(parts.alpha) !== null);
};

/**
 * Resolve a token or color literal for a non-DOM renderer such as ECharts.
 * Unsupported CSS expressions are rejected rather than passed through to the
 * renderer. Missing/unknown tokens use the registered text-color fallback and
 * emit a diagnostic warning so a token registration error remains visible.
 */
export const resolveCssColor = (value: string, fallback = ""): string => {
  const attempt = (candidate: string, callerFallback: string, stack: Set<string>, depth: number): string | null => {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    const reference = unwrapVar(trimmed);
    if (!reference) {
      if (isConcreteColor(trimmed)) return trimmed;
      reportResolutionIssue(`invalid or unsupported color ${trimmed}; using fallback`);
      return null;
    }
    const registered = COLOR_FALLBACKS[reference.name] || "";
    if (depth >= MAX_VAR_RESOLUTION_DEPTH || stack.has(reference.name)) {
      reportResolutionIssue(`color token cycle/depth limit while resolving ${reference.name}; using fallback`);
      return [reference.fallback || "", callerFallback, registered].map((item) => item.trim()).find(isConcreteColor) || null;
    }
    const nextStack = new Set(stack);
    nextStack.add(reference.name);
    const raw = readRawCssToken(reference.name);
    if (!raw && !reference.fallback && !registered) {
      reportResolutionIssue(`unknown color token ${reference.name}; using fallback`);
    }
    // An invalid live value must not outrank a valid caller/registered fallback.
    return attempt(raw, callerFallback, nextStack, depth + 1)
      || attempt(reference.fallback || "", "", nextStack, depth + 1)
      || attempt(callerFallback, "", nextStack, depth + 1)
      || attempt(registered, "", nextStack, depth + 1);
  };
  return attempt(value, fallback, new Set<string>(), 0)
    || attempt(fallback, "", new Set<string>(), 0)
    || SAFE_COLOR_FALLBACK;
};

export const readCssColor = (name: string, fallback = ""): string =>
  resolveCssColor(`var(${normalizeTokenName(name)})`, fallback);

/**
 * Apply alpha by compositing opacity: an existing alpha is multiplied by the
 * requested alpha, never replaced. This prevents a translucent border/grid
 * token from being accidentally made more opaque by a later projection.
 */
export const alphaColor = (color: string, alpha: number, fallback = ""): string => {
  const resolved = resolveCssColor(color, fallback);
  const parsed = parseColor(resolved);
  if (!parsed) {
    reportResolutionIssue(`unsupported color literal ${resolved}; using ${safeConcreteFallback(fallback || SAFE_COLOR_FALLBACK)}`);
    return safeConcreteFallback(fallback || SAFE_COLOR_FALLBACK);
  }
  return formatRgba({ ...parsed, alpha: parsed.alpha * clampAlpha(alpha) });
};

const ECHARTS_COLOR_KEYS = new Set([
  "color",
  "backgroundColor",
  "borderColor",
  "shadowColor",
  "textColor",
  "textBorderColor",
  "textShadowColor",
]);

// Payloads may contain arbitrary user keys, including "color".
const ECHARTS_CONTENT_KEYS = new Set([
  "dataset", "source", "dimensions", "encode", "value", "values", "categories", "info",
]);
const ECHARTS_DATA_KEYS = new Set(["data", "nodes", "links", "edges"]);
const ECHARTS_DATA_STYLE_KEYS = new Set([
  "itemStyle", "lineStyle", "areaStyle", "textStyle", "label", "labelLine",
  "upperLabel", "emphasis", "blur", "select", "tooltip",
]);

/**
 * Clone an ECharts option and project only explicit color slots for
 * zrender/canvas, including palettes, gradients and visualMap color mappings.
 * User content, raw data, fixed literals and callback identities stay intact.
 * Option/style containers must be acyclic; opaque payloads are not traversed.
 */
export const resolveEChartsOptionColors = <T>(option: T): T => {
  const visit = (value: unknown, key?: string, parentKey?: string): unknown => {
    if (ECHARTS_CONTENT_KEYS.has(key || "")) return value;
    if (typeof value === "string") {
      return ECHARTS_COLOR_KEYS.has(key || "") && UNRESOLVED_COLOR_EXPRESSION.test(value)
        ? resolveCssColor(value)
        : value;
    }
    if (Array.isArray(value)) return value.map((item) => visit(item, key, parentKey));
    if (!value || typeof value !== "object") return value;
    const prototype = Object.getPrototypeOf(value);
    const isGradient = ECHARTS_COLOR_KEYS.has(key || "") &&
      Array.isArray((value as { colorStops?: unknown }).colorStops);
    if (prototype !== Object.prototype && prototype !== null && !isGradient) return value;

    // Mapping category names and rich-text style names are not option keys.
    const isColorMapping = key === "color" && (parentKey === "inRange" || parentKey === "outOfRange");
    const result = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => {
      if (ECHARTS_DATA_KEYS.has(key || "") && !(key === "data" && childKey === "children") && !ECHARTS_DATA_STYLE_KEYS.has(childKey)) {
        return [childKey, childValue];
      }
      const projectedKey = isColorMapping ? "color"
        : key === "rich" ? "textStyle"
        : key === "data" && childKey === "children" ? "data"
        : childKey;
      return [childKey, visit(childValue, projectedKey, key)];
    }));
    return isGradient ? Object.create(prototype, Object.getOwnPropertyDescriptors(result)) : result;
  };

  return visit(option) as T;
};

export const cssColorFallbacks = Object.freeze({ ...COLOR_FALLBACKS });
