#!/usr/bin/env node

/**
 * Read-only stack/actual-startup guard. Docker Compose owns env/YAML parsing;
 * canonical JSON and secrets stay in memory, diagnostics never echo raw values.
 *
 * Standalone: missing env files may skip; known shared PG data requires equal
 * backend keys. Unknown targets are NOT evidence of isolation, even equal keys.
 * --startup local|docker: .env.dev is mandatory; process.env is the effective
 * startup environment (the caller must first load defaults and personal env).
 * local renders dev independently from .env.dev + optional .env.local and then
 * verifies the actual host/port/db/URL and keys. docker passes explicit process
 * overrides to dev only. Prod always renders from its own file, unpolluted.
 *
 * If prod env is absent startup can only verify a bounded dev-only target:
 * both binds must live under physical data/dev; production isolation is untested.
 */

import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bindSource, composeService, pathWithin, pathsOverlap, physicalPath,
  renderCompose, serviceEnvironment,
} from "./compose-config.mjs";

const SECRET_KEYS = ["SECRET_KEY", "AGENT_API_KEY_ENCRYPTION_KEY"];
const KEY_IMPACT = {
  SECRET_KEY: "JWT 签名校验不一致",
  AGENT_API_KEY_ENCRYPTION_KEY: "既有 api_key_encrypted 等密文可能无法解密",
};

function guardError(message) {
  const error = new Error(message);
  error.code = "ENV_CONSISTENCY_FAILED";
  return error;
}

function isFile(file) {
  try { return statSync(file).isFile(); }
  catch (error) { if (error.code === "ENOENT") return false; throw guardError("配置文件无法读取；请检查文件及访问权限。"); }
}

function requiredString(value) {
  return typeof value === "string" && value.length > 0 && !/[\0\r\n]/.test(value);
}

function port(value) {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+$/.test(String(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 65535 ? number : null;
}

const hostName = (host) => typeof host === "string" ? host.replace(/^\[|\]$/g, "").toLowerCase() : "";

function databaseUrl(value) {
  try {
    if (!requiredString(value)) throw new Error();
    const url = new URL(value);
    if (!/^postgres(?:ql)?(?:\+(?:asyncpg|psycopg|psycopg2))?:$/.test(url.protocol) || url.hash) throw new Error();
    const keys = [...url.searchParams.keys()];
    // libpq/driver host, port, dbname, service, options etc. can override URL
    // identity. Only non-routing options with no duplicates are understood.
    if (new Set(keys).size !== keys.length || keys.some((key) => !["ssl", "sslmode", "connect_timeout", "application_name"].includes(key))) throw new Error();
    const db = decodeURIComponent(url.pathname.slice(1));
    const host = hostName(url.hostname);
    const parsedPort = port(url.port || "5432");
    if (!requiredString(db) || db.includes("/") || !host || !parsedPort) throw new Error();
    return { host, port: parsedPort, db };
  } catch {
    throw guardError("数据库目标未知；请使用可确认的 PostgreSQL 主机、端口和库名，移除会改写目标的连接参数。");
  }
}

function databaseFields(environment) {
  const host = hostName(environment.POSTGRES_HOST);
  const parsedPort = port(environment.POSTGRES_PORT);
  const db = environment.POSTGRES_DB;
  if (!host || !parsedPort || !requiredString(db)) throw guardError("数据库目标未知；请补齐有效 POSTGRES_HOST/PORT/DB 并核对 DATABASE_URL。");
  return { host, port: parsedPort, db };
}

function sameTarget(a, b) {
  return a.host === b.host && a.port === b.port && a.db === b.db;
}

function stack(config) {
  const postgres = composeService(config, "postgres");
  const pgEnv = serviceEnvironment(config, "postgres");
  const backend = serviceEnvironment(config, "backend");
  if (!requiredString(pgEnv.POSTGRES_DB)) throw guardError("Compose postgres 数据库名未知；请配置明确的 POSTGRES_DB。");
  const containerPort = port(pgEnv.PGPORT ?? "5432");
  if (!containerPort) throw guardError("Compose postgres 端口未知；请检查数据库监听端口。");
  const names = new Set(["postgres", ...[postgres.container_name, postgres.hostname].filter(requiredString)].map(hostName));
  const target = databaseFields(backend);
  if (!names.has(target.host) || target.port !== containerPort || target.db !== pgEnv.POSTGRES_DB) {
    throw guardError("Compose backend 未指向本栈 postgres；请核对 backend 的 POSTGRES_HOST/PORT/DB 及连接覆盖配置。");
  }
  if (backend.DATABASE_URL != null && backend.DATABASE_URL !== "") {
    const urlTarget = databaseUrl(backend.DATABASE_URL);
    if (!names.has(urlTarget.host) || urlTarget.port !== containerPort || urlTarget.db !== pgEnv.POSTGRES_DB) {
      throw guardError("Compose backend DATABASE_URL 目标与本栈 postgres 不一致；请核对连接覆盖配置。");
    }
  }
  return {
    postgres, backend, db: pgEnv.POSTGRES_DB, containerPort,
    pg: bindSource(config, "postgres", "/var/lib/postgresql/data"),
    redis: bindSource(config, "redis", "/data"),
  };
}

function checkLocalActual(dev, environment) {
  const actual = databaseFields(environment);
  if (!["localhost", "127.0.0.1", "::1"].includes(actual.host) || actual.db !== dev.db) {
    throw guardError("实际开发数据库目标与 dev postgres 不一致；请核对 .env.dev、.env.local 的主机/端口/库名并重新加载。");
  }
  const ports = dev.postgres.ports;
  if (!Array.isArray(ports) || ports.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) {
    throw guardError("dev postgres 发布端口未知；请配置明确的 TCP published/target 端口。");
  }
  const candidates = ports.filter((entry) => port(entry.target) === dev.containerPort && (entry.protocol ?? "tcp") === "tcp");
  const reachable = (ip) => {
    const host = hostName(ip ?? "0.0.0.0");
    if (["0.0.0.0", "127.0.0.1"].includes(host)) return actual.host !== "::1";
    if (["::", "::1"].includes(host)) return actual.host !== "127.0.0.1";
    return false;
  };
  if (candidates.length === 0 || candidates.some((entry) => !port(entry.published)) || !candidates.some((entry) => port(entry.published) === actual.port && reachable(entry.host_ip))) {
    throw guardError("实际开发端口不是 dev postgres 的有效 published 端口；请核对 POSTGRES_HOST/PORT 与 Compose 端口映射。");
  }
  const url = databaseUrl(environment.DATABASE_URL);
  if (!sameTarget(url, actual)) {
    throw guardError("实际 DATABASE_URL 与 POSTGRES_HOST/PORT/DB 不一致；请重新生成同一开发目标的连接串。");
  }
  for (const key of SECRET_KEYS) {
    if (!requiredString(environment[key]) || !requiredString(dev.backend[key]) || environment[key] !== dev.backend[key]) {
      throw guardError(`实际 ${key} 与 dev backend 生效值不一致或未知；请核对 .env.dev 与 .env.local 后重新加载，勿替换既有密文所需密钥。`);
    }
  }
}

function checkStartupKeys(dev) {
  for (const key of SECRET_KEYS) {
    if (!requiredString(dev.backend[key])) throw guardError(`dev backend ${key} 生效值未知；请在开发环境配置中明确设置。`);
  }
}

function compareStacks(prod, dev, startup, notes) {
  const shared = prod.pg === dev.pg;
  const pairs = [[prod.pg, dev.pg], [prod.pg, dev.redis], [prod.redis, dev.pg], [prod.redis, dev.redis]];
  if (startup && (pathsOverlap(dev.pg, dev.redis) || pairs.some(([a, b]) => pathsOverlap(a, b)))) {
    throw guardError("开发与生产数据路径共用或重叠，无法确认隔离；请为 postgres 和 redis 配置独立 bind 目录后重试。");
  }
  if (pairs.some(([a, b], index) => pathsOverlap(a, b) && (a !== b || index === 1 || index === 2))) {
    throw guardError("两栈数据路径交叠，无法确认隔离；请检查 postgres/redis 的实际 bind 目录。");
  }
  for (const key of SECRET_KEYS) {
    const a = prod.backend[key];
    const b = dev.backend[key];
    if (shared && (!requiredString(a) || !requiredString(b) || a !== b)) {
      throw guardError(`${key}：共用 Postgres 数据目录时关键密钥必须一致且明确配置；${KEY_IMPACT[key]}。请保留能解开既有密文的密钥，或改用独立数据目录。`);
    }
    if (!shared && (!requiredString(a) || !requiredString(b))) notes.push(`${key}：仅单侧配置或未配置，生效值不完整；不据此推断隔离。`);
  }
  if (shared) return "两栈共用 Postgres 数据目录，关键密钥一致（不是隔离模式）";
  if (prod.redis === dev.redis) return "Postgres 数据目录已分离，密钥允许不同；Redis 仍共用，未确认两栈完整隔离";
  return "两栈 Postgres/Redis 数据目录已分离，关键密钥允许不同";
}

function checkDevOnly(dev, root) {
  const expectedBase = resolve(physicalPath(root), "data/dev");
  const base = physicalPath(resolve(root, "data/dev"));
  if (base !== expectedBase || [dev.pg, dev.redis].some((source) => source === base || !pathWithin(base, source)) || pathsOverlap(dev.pg, dev.redis)) {
    throw guardError("缺少生产配置时仅支持物理 data/dev 内互不重叠的 postgres/redis bind；请修正开发数据目录，或提供生产 env 以核对自定义目标隔离。");
  }
  return "dev-only 开发目标与 data/dev 边界已核对；生产配置缺失，未验证两栈隔离";
}

function options(argv) {
  const result = { stackA: ".env", stackB: ".env.dev", composeA: "docker-compose.yml", composeB: "docker-compose.dev.yml" };
  const names = { "--stack-a": "stackA", "--stack-b": "stackB", "--compose-a": "composeA", "--compose-b": "composeB", "--startup": "startup" };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const key = names[argv[index]];
    const value = argv[index + 1];
    if (!key || seen.has(key) || !value || value.startsWith("--")) throw guardError("参数无效；使用 --startup local|docker，或指定两栈 env/compose 文件。");
    seen.add(key);
    result[key] = value;
  }
  if (result.startup && !["local", "docker"].includes(result.startup)) throw guardError("启动模式无效；使用 --startup local 或 --startup docker。");
  return result;
}

function main() {
  const args = options(process.argv.slice(2));
  const root = process.env.ENV_CHECK_ROOT ? resolve(process.env.ENV_CHECK_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const prodExists = isFile(resolve(root, args.stackA));
  const devExists = isFile(resolve(root, args.stackB));
  if (args.startup && !devExists) throw guardError("startup 必须有 .env.dev 开发配置；不允许回退生产环境，请先创建并核对开发 env。");
  if (!args.startup && (!prodExists || !devExists)) {
    console.log("Env consistency check skipped: missing env files（standalone 可跳过；不表示数据隔离已验证）");
    return;
  }
  const devFiles = [args.stackB];
  if (args.startup && isFile(resolve(root, ".env.local"))) devFiles.push(".env.local");
  const prod = prodExists ? stack(renderCompose({ root, envFile: args.stackA, composeFile: args.composeA })) : null;
  const dev = stack(renderCompose({ root, envFile: devFiles, composeFile: args.composeB, ...(args.startup === "docker" ? { environment: process.env } : {}) }));
  if (args.startup) {
    checkStartupKeys(dev);
    if (args.startup === "local") checkLocalActual(dev, process.env);
  }
  const notes = [];
  const summary = prod ? compareStacks(prod, dev, args.startup, notes) : checkDevOnly(dev, root);
  for (const note of notes) console.log(`- ${note}`);
  console.log(`Env consistency check passed: ${summary}`);
}

try {
  main();
} catch (error) {
  const known = ["ENV_CONSISTENCY_FAILED", "COMPOSE_CONFIG_FAILED", "COMPOSE_CONFIG_INVALID", "COMPOSE_PATH_UNKNOWN", "COMPOSE_TARGET_UNKNOWN"].includes(error?.code);
  console.error(`Env consistency check failed: ${known ? error.message : "无法确认环境与数据目标；请检查两栈配置及 Docker Compose 可用性。"}`);
  process.exitCode = 1;
}
