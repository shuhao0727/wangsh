type AnyObj = Record<string, unknown>;

function isObj(v: unknown): v is AnyObj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  const s = typeof v === "string" ? v : "";
  const t = s.trim();
  return t ? t : null;
}

function humanizeKnownMessage(message: string): string {
  if (/^ai agent not configured$/i.test(message)) {
    return "AI 优化智能体未配置，请先在 PythonLab 智能体配置中填写 API 地址、密钥和模型。";
  }
  return message;
}

export function toErrorMessage(e: unknown, fallback: string): string {
  if (isObj(e)) {
    const userMessage = pickString(e.userMessage);
    if (userMessage) return humanizeKnownMessage(userMessage);
    const resp = e.response;
    if (isObj(resp)) {
      const data = resp.data;
      if (isObj(data)) {
        const detail = pickString(data.detail);
        if (detail) return humanizeKnownMessage(detail);
        const msg = pickString(data.message);
        if (msg) return humanizeKnownMessage(msg);
      } else {
        const detail = pickString(data);
        if (detail) return humanizeKnownMessage(detail);
      }
    }
    const message = pickString(e.message);
    if (message && !/^request failed with status code \d+$/i.test(message)) return humanizeKnownMessage(message);
  }
  const direct = pickString(e instanceof Error ? e.message : null);
  if (direct) return humanizeKnownMessage(direct);
  const fb = String(fallback || "").trim();
  return fb || "未知错误";
}
