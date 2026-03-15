export type ConversionFailureCategory = "syntax_error" | "semantic_error" | "structure_loss" | "network_timeout" | "noise_log";

export type ConversionFailureSignal = {
  category: ConversionFailureCategory;
  signatures: string[];
  shouldTriggerAiFallback: boolean;
};

const NOISE_PATTERNS = [/indexsizeerror/i, /content-script/i, /chrome-extension:\/\//i, /react devtools/i, /monaco/i, /\bworker\b/i, /sourcemap/i];
const SYNTAX_PATTERNS = [/\bsyntaxerror\b/i, /\bindentationerror\b/i, /\binvalid syntax\b/i];
const STRUCTURE_PATTERNS = [/\bhas_next\s*\(/i, /(^|\n)\s*it\s+in\s+.+$/im, /(^|\n)\s*while\s+.+的值在列表[:?：]?\s*$/m];

const normalize = (s: string) => String(s || "").trim();

const matchAny = (txt: string, pats: RegExp[]) => pats.some((re) => re.test(txt));

export function classifyConversionFailure(params: {
  code: string;
  strictOk: boolean;
  strictErrors?: string[];
  warnings?: string[];
  upstreamError?: unknown;
}): ConversionFailureSignal {
  const code = normalize(params.code);
  const strictErrors = (params.strictErrors || []).map((x) => normalize(x)).filter(Boolean);
  const warnings = (params.warnings || []).map((x) => normalize(x)).filter(Boolean);
  const upstream = params.upstreamError as any;
  const upstreamTxt = normalize(
    [
      upstream?.name,
      upstream?.message,
      upstream?.code,
      upstream?.response?.statusText,
      String(upstream?.response?.status || ""),
      upstream?.request && !upstream?.response ? "xhr_no_response" : "",
      typeof params.upstreamError === "string" ? params.upstreamError : "",
    ]
      .filter(Boolean)
      .join(" ")
  );
  const merged = [code, strictErrors.join("\n"), warnings.join("\n"), upstreamTxt].join("\n");

  const signatures = new Set<string>();
  if (matchAny(merged, STRUCTURE_PATTERNS)) signatures.add("iter_leak_or_nonpython_loop");
  if (!params.strictOk || strictErrors.length || matchAny(merged, SYNTAX_PATTERNS)) signatures.add("syntax_invalid");
  if (warnings.some((w) => w.includes("for 归纳失败"))) signatures.add("for_inference_failed");
  if (upstream?.request && !upstream?.response) signatures.add("network_timeout");
  if (/\btimeout\b/i.test(merged) || /\beconnaborted\b/i.test(merged) || /\bnetwork error\b/i.test(merged)) signatures.add("network_timeout");
  if (matchAny(merged, NOISE_PATTERNS)) signatures.add("noise_log");
  if (!code.trim().length || /\bpass\b/.test(code) || /\b结构化识别失败\b/.test(merged)) signatures.add("structure_loss");

  if (signatures.has("noise_log")) {
    return { category: "noise_log", signatures: Array.from(signatures), shouldTriggerAiFallback: false };
  }
  if (signatures.has("network_timeout")) {
    return { category: "network_timeout", signatures: Array.from(signatures), shouldTriggerAiFallback: false };
  }
  if (signatures.has("iter_leak_or_nonpython_loop") || signatures.has("structure_loss")) {
    return { category: "structure_loss", signatures: Array.from(signatures), shouldTriggerAiFallback: true };
  }
  if (signatures.has("syntax_invalid")) {
    return { category: "syntax_error", signatures: Array.from(signatures), shouldTriggerAiFallback: true };
  }
  return { category: "semantic_error", signatures: Array.from(signatures), shouldTriggerAiFallback: warnings.length > 0 };
}
