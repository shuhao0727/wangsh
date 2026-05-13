/** Shared auth-expired detail reader — used by BasicLayout banner + UserMenu login popup */
export function getAuthExpiredReason(): string {
  if (typeof window === "undefined") return "";
  const detail = (
    window as typeof window & {
      __wsLastAuthExpiredDetail?: { reason?: string; kind?: string } | null;
    }
  ).__wsLastAuthExpiredDetail;
  const reason = typeof detail?.reason === "string" ? detail.reason.trim() : "";
  const kind = typeof detail?.kind === "string" ? detail.kind : "";
  if (kind === "replaced" || reason.includes("其他地方登录")) {
    return "你的账号已在其他地方登录，当前设备已下线，请重新登录";
  }
  if (kind === "ip_changed" || reason.includes("环境已变更")) {
    return reason || "登录环境已变更，请重新登录";
  }
  return reason;
}
