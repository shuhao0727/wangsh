type AnyObj = Record<string, unknown>;

function isObj(v: unknown): v is AnyObj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  const s = typeof v === "string" ? v : "";
  const t = s.trim();
  return t ? t : null;
}

export function toErrorMessage(e: unknown, fallback: string): string {
  const direct = pickString(e instanceof Error ? e.message : null);
  if (direct) return direct;
  if (isObj(e)) {
    const userMessage = pickString(e.userMessage);
    if (userMessage) return userMessage;
    const message = pickString(e.message);
    if (message) return message;
    const resp = e.response;
    if (isObj(resp)) {
      const data = resp.data;
      if (isObj(data)) {
        const detail = pickString(data.detail);
        if (detail) return detail;
        const msg = pickString(data.message);
        if (msg) return msg;
      } else {
        const detail = pickString(data);
        if (detail) return detail;
      }
    }
  }
  const fb = String(fallback || "").trim();
  return fb || "未知错误";
}

