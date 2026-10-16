import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(repoRoot, "scripts/check-env-consistency.mjs");

const PROD_KEY = "7p9uJ3GHxTeU_xuwxxJdqvfLvXOsvndncXFkdAi4q-g=";
const DEV_KEY = "pI93AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const JWT_A = "0287507e5e5600000000000000000000000000000";
const JWT_B = "5f370992b22c0000000000000000000000000000000000";

/**
 * Run the checker against two fixture env files written into a temp root.
 * ENV_CHECK_ROOT keeps the read-only script pointed at the fixture.
 */
function runFixture(stackA, stackB, files) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wangsh-env-consistency-"));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(tempRoot, name), content);
  }
  const result = spawnSync(
    process.execPath,
    [script, "--stack-a", stackA, "--stack-b", stackB],
    { env: { ...process.env, ENV_CHECK_ROOT: tempRoot }, encoding: "utf8" },
  );
  fs.rmSync(tempRoot, { recursive: true, force: true });
  return result;
}

const envText = (agentKey, jwtKey) =>
  [
    `AGENT_API_KEY_ENCRYPTION_KEY=${agentKey}`,
    `SECRET_KEY=${jwtKey}`,
    "",
  ].join("\n");

test("passes when both stacks share identical secret values", () => {
  const result = runFixture(".env", ".env.dev", {
    ".env": envText(PROD_KEY, JWT_A),
    ".env.dev": envText(PROD_KEY, JWT_A),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed/);
});

test("fails when AGENT_API_KEY_ENCRYPTION_KEY differs between stacks", () => {
  // Regression for audit P0-2: dev encrypted api_key_encrypted while prod read
  // the shared database with a different key, so decryption silently failed.
  const result = runFixture(".env", ".env.dev", {
    ".env": envText(PROD_KEY, JWT_A),
    ".env.dev": envText(DEV_KEY, JWT_A),
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /AGENT_API_KEY_ENCRYPTION_KEY/);
  assert.match(result.stderr, /api_key_encrypted/);
});

test("fails when SECRET_KEY differs between stacks", () => {
  const result = runFixture(".env", ".env.dev", {
    ".env": envText(PROD_KEY, JWT_A),
    ".env.dev": envText(PROD_KEY, JWT_B),
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /SECRET_KEY/);
});

test("never prints raw secret values", () => {
  const result = runFixture(".env", ".env.dev", {
    ".env": envText(PROD_KEY, JWT_A),
    ".env.dev": envText(DEV_KEY, JWT_B),
  });

  assert.equal(result.status, 1);
  const output = result.stdout + result.stderr;
  assert.ok(!output.includes(PROD_KEY), "prod key leaked");
  assert.ok(!output.includes(DEV_KEY), "dev key leaked");
  assert.ok(!output.includes(JWT_A), "jwt key leaked");
  assert.ok(!output.includes(JWT_B), "jwt key leaked");
  // fingerprints are still shown so operators can compare
  assert.match(output, /fp=[0-9a-f]{12}/);
});

test("skips instead of failing when env files are absent (CI checkout)", () => {
  // .env and .env.* are gitignored, so CI never has them; the gate must not
  // turn a missing optional file into a false failure.
  const result = runFixture(".env", ".env.dev", {});

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /skipped/);
});

test("notes single-sided configuration without failing", () => {
  const result = runFixture(".env", ".env.dev", {
    ".env": envText(PROD_KEY, JWT_A),
    ".env.dev": "SECRET_KEY=" + JWT_A + "\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /仅单侧配置/);
});
