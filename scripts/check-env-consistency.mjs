#!/usr/bin/env node

/**
 * 两栈环境一致性检查（D-5 数据源统一后的必需护栏）。
 *
 * 背景：docker-compose.yml 与 docker-compose.dev.yml 按 D-5 约定共用同一个
 * ./data/postgres 目录，但各自读取不同的 env 文件（.env / .env.dev）。凡是
 * 「加密/签名后落库、下次读库再解密」的密钥一旦两栈不一致，就会出现
 * **行还在、字段仍显示已配置、但解密全部失败** 的静默故障：
 *
 *   - AGENT_API_KEY_ENCRYPTION_KEY：znt_agents.api_key_encrypted 解不开，
 *     表现为后台显示「已配置 …xxxx」而智能体对话必失败（审计 P0-2）。
 *   - SECRET_KEY：JWT 签名/校验密钥，切栈后旧 token 全部失效。
 *
 * 本脚本只做**只读比对**，不打印任何密钥明文，只输出指纹用于人工核对。
 * 指纹口径与下方 log 一致：sha256 前 12 个 hex 字符。
 *
 * 用法：
 *   node scripts/check-env-consistency.mjs
 *   node scripts/check-env-consistency.mjs --stack-a .env --stack-b .env.dev
 *
 * 退出码：0 = 一致或无法判定（缺文件时按用途降级）；1 = 检出不一致。
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = process.env.ENV_CHECK_ROOT
  ? resolve(process.env.ENV_CHECK_ROOT)
  : resolve(scriptDir, "..");

const readEnvFile = (path) => {
  const abs = resolve(root, path);
  if (!existsSync(abs)) return null;
  const values = new Map();
  for (const rawLine of readFileSync(abs, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    values.set(line.slice(0, index), line.slice(index + 1).trim());
  }
  return values;
};

// 只输出指纹，绝不输出明文；同一密钥在两栈应得到同一指纹。
const fingerprint = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);

// 落库后需要「同一密钥才能再解开」的字段。缺失时不算失败（可能未启用该功能），
// 但只要两边都有值且指纹不同，就是必然的静默故障。
const SHARED_SECRET_KEYS = [
  {
    name: "AGENT_API_KEY_ENCRYPTION_KEY",
    impact:
      "znt_agents.api_key_encrypted 将无法解密：后台仍显示已配置，但智能体对话必然失败（审计 P0-2）",
  },
  {
    name: "SECRET_KEY",
    impact: "JWT 签名密钥不一致：切栈后旧 access token 校验失败；refresh token 的数据库校验另按认证实现处理",
  },
];

const argOf = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const stackA = argOf("--stack-a") ?? ".env";
const stackB = argOf("--stack-b") ?? ".env.dev";
const envA = readEnvFile(stackA);
const envB = readEnvFile(stackB);

if (!envA || !envB) {
  const missing = [
    envA ? null : stackA,
    envB ? null : stackB,
  ].filter(Boolean);
  // 两套 env 都在 .gitignore 中（.env、.env.*），CI checkout 里通常不存在。
  // 缺文件时按「无法判定」处理并跳过，避免在缺少凭据的环境里误报失败。
  console.log(
    `Env consistency check skipped: missing ${missing.join(", ")} (env files are gitignored; run locally alongside both stacks)`,
  );
  process.exit(0);
}

const failures = [];
const notes = [];

for (const { name, impact } of SHARED_SECRET_KEYS) {
  const a = envA.get(name);
  const b = envB.get(name);
  if (!a && !b) {
    notes.push(`${name}: 两栈均未配置，跳过`);
    continue;
  }
  if (!a || !b) {
    // 只有一侧配置：不算密钥冲突，但值得提醒，因为共用数据库时
    // 未配置那一侧的进程可能写出另一侧读不了的数据。
    const missingSide = !a ? stackA : stackB;
    notes.push(`${name}: 仅单侧配置（${missingSide} 缺失），共用数据库时可能导致落库数据不可读`);
    continue;
  }
  if (a !== b) {
    failures.push(
      [
        `${name} 两栈不一致：`,
        `${stackA} fp=${fingerprint(a)} (${a.length} chars)`,
        `${stackB} fp=${fingerprint(b)} (${b.length} chars)`,
        `影响：${impact}`,
      ].join(" "),
    );
  }
}

if (failures.length > 0) {
  console.error(
    `Env consistency check failed: ${stackA} 与 ${stackB} 共用同一 Postgres 数据目录，关键密钥必须一致。`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(
    "修复：把两栈该键统一为同一把。若库中已有密文，必须保留**能解开既存密文**的那把（可用 /health 的 agent_secrets 项确认）。",
  );
  process.exit(1);
}

for (const note of notes) console.log(`- ${note}`);
console.log(
  `Env consistency check passed: ${stackA} 与 ${stackB} 的共享密钥指纹一致（已比对 ${SHARED_SECRET_KEYS.length} 个键）`,
);
