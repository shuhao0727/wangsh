import { diffVarTrace } from "./varTrace";
import { config } from "@services/config";

export { diffVarTrace };

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
    default:
      return null;
  }
}

export function wsUrl(path: string, token: string | null): string {
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
      if (token && token.trim()) {
        return `${protocol}//${host}${path}?token=${encodeURIComponent(token)}`;
      }
      return `${protocol}//${host}${path}`;
  } catch (e) {
      // Fallback
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      if (token && token.trim()) {
        return `${protocol}//${window.location.host}${path}?token=${encodeURIComponent(token)}`;
      }
      return `${protocol}//${window.location.host}${path}`;
  }
}
