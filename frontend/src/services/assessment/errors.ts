/**
 * 测评模块共享的错误解析。
 *
 * config / profile / session 三个 services 文件此前各有一份完全相同的
 * `asApiError` 与 `toDetailMessage`，只改一处就会造成提示口径不一致，
 * 因此收敛到这里。
 */

export interface ApiErrorShape {
  message?: string;
  response?: { data?: { detail?: unknown } };
}

interface ValidationErrorItem {
  loc?: unknown;
  msg?: unknown;
  message?: unknown;
}

export const asApiError = (e: unknown): ApiErrorShape =>
  (e && typeof e === "object" ? e : {}) as ApiErrorShape;

export const toDetailMessage = (detail: unknown): string | undefined => {
  if (!detail) return undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return (
      detail
        .map((d: string | ValidationErrorItem) => {
          if (typeof d === "string") return d;
          const loc = Array.isArray(d?.loc) ? d.loc.join(".") : "";
          const msg = String(d?.msg || d?.message || "");
          return [loc, msg].filter(Boolean).join(": ");
        })
        .filter(Boolean)
        .join("；") || undefined
    );
  }
  if (typeof detail === "object") {
    const obj = detail as Record<string, unknown>;
    return String(obj.msg || obj.message || JSON.stringify(detail));
  }
  return String(detail);
};
