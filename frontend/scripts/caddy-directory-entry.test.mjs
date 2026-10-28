/**
 * 前端 Caddy 生产配置的目录入口契约（对应 51cf5c0 的回滚项）。
 *
 * 背景：`/games/ai-partner` 是独立的静态 HTML 应用，不是主站 SPA 的一条路由。
 * 只写 `/games/ai-partner/*` 时，带尾斜线的请求会命中目录分支返回 404；
 * 而如果改成回退到 `/index.html`，缺失的 JS 会拿到主站 HTML 并返回 200，
 * 浏览器会把 HTML 当模块脚本解析，报 MIME 错误。
 *
 * 这里只做**静态源码合同**：真实 Caddy HTTP 行为（200/404、cache header、MIME）
 * 需要用同一候选配置起容器验证，不能用手工推导代替。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../caddy/Caddyfile.prod", import.meta.url), "utf8");
const block = (name) => config.match(new RegExp(`handle\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\t\\}`))?.[1] ?? "";
const aiPartner = block("@ai_partner");
const staticAssets = block("@static_assets");

test("AI Partner 的裸路径与目录都命中它自己的 index，不回退主站 SPA", () => {
  // 必须同时匹配裸路径与目录通配，否则 `/games/ai-partner/` 会 404
  assert.match(config, /@ai_partner\s+path\s+\/games\/ai-partner\s+\/games\/ai-partner\/\*/);
  assert.ok(aiPartner, "找不到 @ai_partner 的 handle 块");
  assert.match(aiPartner, /try_files\s+\{path\}\s+\{path\}\/index\.html\s+=404/);
  // 关键否定断言：独立入口里不能出现主站根 index.html
  assert.doesNotMatch(aiPartner, /try_files[^\n]*\s\/index\.html/);
  assert.match(aiPartner, /Cache-Control\s+"no-cache"/);
});

test("缺失的 AI Partner 资源保持显式 404，静态资源同样不回退", () => {
  assert.match(aiPartner, /try_files[^\n]*=404/);
  assert.ok(staticAssets, "找不到 @static_assets 的 handle 块");
  assert.match(staticAssets, /try_files\s+\{path\}\s+=404/);
  assert.doesNotMatch(staticAssets, /index\.html/);
});

test("主站 SPA 回退仍然保留，目录路由不被破坏", () => {
  const spa = config.match(/handle\s*\{([\s\S]*?)\n\t\}/)?.[1] ?? "";
  assert.ok(spa, "找不到 SPA 兜底 handle 块");
  assert.match(spa, /try_files\s+\{path\}\s+\{path\}\/index\.html\s+\/index\.html/);
});

test("CSP 仍允许内容运行时所需的 jsdelivr 脚本源", () => {
  // KaTeX / highlight.js / Mermaid / Markmap 由 contentRuntimeLoader 动态注入
  assert.match(config, /script-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  // 其他边界保持收紧
  assert.match(config, /object-src 'none';/);
  assert.match(config, /base-uri 'self';/);
  assert.match(config, /form-action 'self';/);
});
