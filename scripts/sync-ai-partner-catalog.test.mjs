import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { syncCatalog } from "./sync-ai-partner-catalog.mjs";

test("detects drift without writing and generates the exact runtime copy on request", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wangsh-catalog-contract-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "backend/app/services/ai_partner_catalog.json");
  const target = path.join(root, "frontend/ai-partner/src/catalog.json");
  const bytes = '{"id":"测试","price":2300}\n';
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, bytes);
  assert.throws(() => syncCatalog(root), /catalog differs/);
  assert.ok(!fs.existsSync(target));
  assert.equal(syncCatalog(root, true), "updated");
  assert.equal(fs.readFileSync(target, "utf8"), bytes);
  assert.equal(syncCatalog(root), "unchanged");
  fs.writeFileSync(target, "{}\n");
  assert.throws(() => syncCatalog(root), /--write/);
  assert.equal(fs.readFileSync(target, "utf8"), "{}\n");
});

test("invalid source JSON cannot overwrite the last generated catalog", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wangsh-catalog-invalid-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "backend/app/services/ai_partner_catalog.json");
  const target = path.join(root, "frontend/ai-partner/src/catalog.json");
  for (const file of [source, target]) fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(source, "invalid");
  fs.writeFileSync(target, "{}\n");
  assert.throws(() => syncCatalog(root, true), SyntaxError);
  assert.equal(fs.readFileSync(target, "utf8"), "{}\n");
});
