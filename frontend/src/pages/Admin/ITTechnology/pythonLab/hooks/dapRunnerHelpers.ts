import { diffVarTrace } from "./varTrace";
import { config } from "@services/config";

export { diffVarTrace };

export type DapOutputMeta = {
  source: string;
  ts: string | null;
  wsEpoch: number | null;
  connId: string | null;
  clientConnId: string | null;
};

export function extractLatestTraceback(stdout: string[]): string | null {
  const text = stdout.join("");
  // Try to find the last occurrence of Traceback
  const lines = text.split("\n");
  let lastIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().startsWith("Traceback (most recent call last):")) {
      lastIdx = i;
      break;
    }
  }

  if (lastIdx === -1) return null;
  return lines.slice(lastIdx).join("\n");
}

export function wsCloseHint(code: number): string | null {
  switch (code) {
    case 1000:
      return "正常关闭";
    case 1001:
      return "服务器已离线";
    case 1006:
      return "连接异常断开（可能是网络问题或服务器崩溃）";
    case 1008:
      return "策略违规";
    case 1011:
      return "服务器内部错误";
    case 4401:
      return "登录已过期，请刷新页面";
    case 4403:
      return "无权访问此会话";
    case 4404:
      return "会话不存在或已被清理";
    case 4409:
      return "会话状态异常（未就绪），请稍后重试";
    case 4410:
      return "调试端口无效";
    case 4429:
      return "会话已在其他窗口调试";
    default:
      return null;
  }
}

export function parseDapOutputMeta(body: any): DapOutputMeta {
  const m = body?._meta;
  const source = String(m?.source || "unknown");
  const ts = typeof m?.ts === "string" ? m.ts : null;
  const wsEpoch = Number.isFinite(Number(m?.ws_epoch)) ? Number(m?.ws_epoch) : null;
  const connId = typeof m?.conn_id === "string" ? m.conn_id : null;
  const clientConnId = typeof m?.client_conn_id === "string" ? m.client_conn_id : null;
  return { source, ts, wsEpoch, connId, clientConnId };
}

export function parseDapMessageMeta(msg: any): DapOutputMeta {
  const m = msg?._meta;
  const source = String(m?.source || "unknown");
  const ts = typeof m?.ts === "string" ? m.ts : null;
  const wsEpoch = Number.isFinite(Number(m?.ws_epoch)) ? Number(m?.ws_epoch) : null;
  const connId = typeof m?.conn_id === "string" ? m.conn_id : null;
  const clientConnId = typeof m?.client_conn_id === "string" ? m.client_conn_id : null;
  return { source, ts, wsEpoch, connId, clientConnId };
}

export function wsUrl(path: string, token: string | null): string {
  const appendToken = (p: string, t: string | null) => {
    if (!t || !t.trim()) return p;
    return p.includes("?")
      ? `${p}&token=${encodeURIComponent(t)}`
      : `${p}?token=${encodeURIComponent(t)}`;
  };
  let base = config.apiUrl;
  // Handle relative API URL (e.g. "/api/v1")
  if (base.startsWith("/")) {
    base = window.location.origin + base;
  }

  // base is now absolute, e.g. "http://localhost:8000/api/v1"
  try {
    const url = new URL(base);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const host = url.host;

    // We assume 'path' is the full path from root, e.g. "/api/v1/debug/..."
    // So we just use protocol + host + path
    return `${protocol}//${host}${appendToken(path, token)}`;
  } catch (_e) {
    // Fallback
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${appendToken(path, token)}`;
  }
}
