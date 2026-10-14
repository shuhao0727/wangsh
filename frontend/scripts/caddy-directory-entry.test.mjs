import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../caddy/Caddyfile.prod", import.meta.url), "utf8");

test("AI Partner directory entry resolves its own index without falling back to the main SPA", () => {
  assert.match(config, /@ai_partner\s+path\s+\/games\/ai-partner\s+\/games\/ai-partner\/\*/);
  assert.match(config, /handle\s+@ai_partner\s*\{\s*try_files\s+\{path\}\s+\{path\}\/index\.html\s+=404/);
  assert.doesNotMatch(config.match(/handle\s+@ai_partner\s*\{([\s\S]*?)\n\t\}/)?.[1] ?? "", /try_files[^\n]*\s\/index\.html/);
});

test("missing AI Partner and static resources keep an explicit 404 contract", () => {
  const independent = config.match(/handle\s+@ai_partner\s*\{([\s\S]*?)\n\t\}/)?.[1];
  const assets = config.match(/handle\s+@static_assets\s*\{([\s\S]*?)\n\t\}/)?.[1];
  assert.ok(independent);
  assert.ok(assets);
  assert.match(independent, /try_files[^\n]*=404/);
  assert.match(independent, /Cache-Control\s+"no-cache"/);
  assert.match(assets, /try_files\s+\{path\}\s+=404/);
});

test("font policy permits the pinned CDN used by KaTeX without relaxing other resource boundaries", () => {
  assert.match(config, /font-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  assert.match(config, /object-src 'none';/);
  assert.match(config, /base-uri 'self';/);
  assert.match(config, /form-action 'self';/);
});
