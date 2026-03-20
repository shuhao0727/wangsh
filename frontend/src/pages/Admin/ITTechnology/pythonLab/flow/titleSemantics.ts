const TEACHING_PREFIX_HINTS = ["步骤", "取第一个元素", "获取下一个元素", "分支判断", "循环判断", "否则如果", "输入输出", "调用"] as const;

const DESCRIPTIVE_SUFFIX_HINTS = ["循环", "分支", "判断", "步骤", "开始", "结束", "元素", "教学", "示例", "可读", "readability", "loop", "branch"] as const;

const normalizeBasic = (raw: string) =>
  String(raw || "")
    .replaceAll("\r\n", "\n")
    .replaceAll("　", " ")
    .trim();

const stripTeachingPrefixOnce = (title: string) => {
  const raw = normalizeBasic(title);
  if (!raw) return raw;
  const sep = raw.includes("：") ? "：" : raw.includes(":") ? ":" : "";
  if (!sep) return raw;
  const idx = raw.indexOf(sep);
  if (idx < 0) return raw;
  const prefix = raw.slice(0, idx).trim();
  const body = raw.slice(idx + 1).trim();
  if (!body) return raw;
  if (TEACHING_PREFIX_HINTS.some((hint) => prefix.includes(hint))) return body;
  return raw;
};

const stripDescriptiveSuffixOnce = (title: string) => {
  const raw = normalizeBasic(title);
  if (!raw) return raw;
  const m = /(.*?)(?:\s*[（(]([^()（）]+)[)）]\s*)$/.exec(raw);
  if (!m) return raw;
  const body = m[1].trim();
  const suffix = m[2].trim().toLowerCase();
  if (!body) return raw;
  if (DESCRIPTIVE_SUFFIX_HINTS.some((hint) => suffix.includes(hint.toLowerCase()))) return body;
  return raw;
};

export function normalizeTitleForMapping(title: string) {
  const basic = normalizeBasic(title);
  const strippedPrefix = stripTeachingPrefixOnce(basic);
  const strippedSuffix = stripDescriptiveSuffixOnce(strippedPrefix);
  return strippedSuffix.replaceAll("＝", "=").replaceAll("，", ",").trim();
}

export function normalizeTitleForSemanticCompare(title: string) {
  const mapped = normalizeTitleForMapping(title).normalize("NFKC");
  return mapped.replace(/\s+/g, "").replace(/[？?]+$/g, "");
}

export function isSemanticallySameTitle(a: string, b: string) {
  return normalizeTitleForSemanticCompare(a) === normalizeTitleForSemanticCompare(b);
}

export function normalizeTitleForEditInput(title: string) {
  const normalized = String(title || "").replaceAll("\r\n", "\n").replaceAll("　", " ");
  const trimmedLines = normalized
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n");
  return trimmedLines.replace(/\n+$/g, "");
}
