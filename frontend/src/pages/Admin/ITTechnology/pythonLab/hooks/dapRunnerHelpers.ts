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
      // IMPORTANT: Encode token to handle special characters (e.g. =, +, /)
      return `${protocol}//${host}${path}?token=${encodeURIComponent(token || "")}`;
  } catch (e) {
      // Fallback
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}${path}?token=${encodeURIComponent(token || "")}`;
  }
}
