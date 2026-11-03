import { spawnSync } from "node:child_process";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, posix, relative, resolve, sep } from "node:path";

const RUNTIME_KEYS = [
  "PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SystemRoot", "WINDIR",
  "DOCKER_CONFIG", "DOCKER_CLI_PLUGIN_EXTRA_DIRS", "DOCKER_CONTEXT", "DOCKER_HOST",
  "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH",
];
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Fixed diagnostics only: Compose stdout/stderr can contain expanded secrets.
export function composeError(code) {
  const messages = {
    COMPOSE_CONFIG_FAILED: "Compose 配置无法生成；请检查指定配置文件及 Docker Compose 可用性（原始诊断已隐藏）。",
    COMPOSE_CONFIG_INVALID: "Compose canonical JSON 缺失或无效；无法确认数据目标，请检查 config --format json 输出。",
    COMPOSE_PATH_UNKNOWN: "Compose 数据路径未知；请检查 bind 目录、符号链接与访问权限。",
    COMPOSE_TARGET_UNKNOWN: "Compose 服务数据目标未知；请检查 postgres/redis/backend、唯一 bind 挂载及数据库配置。",
  };
  const error = new Error(messages[code] ?? messages.COMPOSE_TARGET_UNKNOWN);
  error.code = code;
  return error;
}

/** Keep CLI runtime/local-daemon selection, never application interpolation vars. */
export function cleanComposeEnvironment(source = process.env) {
  const context = source.DOCKER_CONTEXT;
  const host = source.DOCKER_HOST;
  if (context && !["default", "desktop-linux"].includes(context)) throw composeError("COMPOSE_CONFIG_FAILED");
  if (host && (!/^unix:\/\/\//.test(host) || host.length <= "unix:///".length || /[\0\r\n?#]/.test(host))) {
    throw composeError("COMPOSE_CONFIG_FAILED");
  }
  return Object.fromEntries(RUNTIME_KEYS.filter((key) => typeof source[key] === "string").map((key) => [key, source[key]]));
}

function composeEnvironment(environment) {
  const clean = cleanComposeEnvironment();
  // Explicit dev interpolation overrides must not change CLI file selection,
  // plugin/daemon settings or load executable code into the child process.
  for (const [key, value] of Object.entries(environment ?? {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== "string") continue;
    if (RUNTIME_KEYS.includes(key) || /^(COMPOSE_|DOCKER_|NODE_|LD_|DYLD_|BASH_|PYTHON|RUBY|PERL)/.test(key)) continue;
    if (["ENV", "ZDOTDIR", "SHELLOPTS", "BASHOPTS", "IFS", "CDPATH", "PWD", "OLDPWD", "ENV_CHECK_ROOT"].includes(key)) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * Read-only, synchronous canonical render. envFile accepts a path or ordered
 * paths (e.g. [.env.dev, .env.local]); later files override earlier files.
 * All paths are absolute before spawning. No YAML/env parser, shell or daemon
 * command is used. Returned JSON stays in memory; errors never retain output.
 */
export function renderCompose({ root, envFile, composeFile, environment } = {}) {
  let result;
  try {
    if (typeof root !== "string" || !root || typeof composeFile !== "string" || !composeFile) throw new Error();
    const files = Array.isArray(envFile) ? envFile : [envFile];
    if (files.length === 0 || files.some((file) => typeof file !== "string" || !file)) throw new Error();
    const cwd = resolve(root);
    const absoluteFiles = files.map((file) => resolve(cwd, file));
    const absoluteCompose = resolve(cwd, composeFile);
    if (![...absoluteFiles, absoluteCompose].every((file) => statSync(file).isFile())) throw new Error();
    result = spawnSync("docker", [
      "compose", ...absoluteFiles.flatMap((file) => ["--env-file", file]),
      "-f", absoluteCompose, "config", "--format", "json",
    ], {
      cwd, env: { ...composeEnvironment(environment), PWD: physicalPath(cwd) }, encoding: "utf8",
      timeout: 15_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    });
  } catch {
    throw composeError("COMPOSE_CONFIG_FAILED");
  }
  if (result.error || result.signal || result.status !== 0) throw composeError("COMPOSE_CONFIG_FAILED");
  try {
    const config = JSON.parse(result.stdout);
    if (!record(config) || !record(config.services) || Object.keys(config.services).length === 0) throw new Error();
    return config;
  } catch {
    throw composeError("COMPOSE_CONFIG_INVALID");
  }
}

/** Resolve symlinks at the nearest existing ancestor; missing leaf dirs are OK. */
export function physicalPath(input) {
  try {
    if (typeof input !== "string" || !input || input.includes("\0")) throw new Error();
    let current = resolve(input);
    const tail = [];
    for (;;) {
      try {
        const info = lstatSync(current);
        // A dangling symlink is not an absent directory. realpath must succeed.
        const real = realpathSync(current);
        if (tail.length && !(info.isSymbolicLink() ? statSync(current) : info).isDirectory()) throw new Error();
        return resolve(real, ...tail);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        // lstat sees dangling links even when realpath cannot resolve them.
        try { if (lstatSync(current).isSymbolicLink()) throw new Error(); }
        catch (probe) { if (probe.code !== "ENOENT") throw probe; }
        const parent = dirname(current);
        if (parent === current) throw new Error();
        tail.unshift(current.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
        current = parent;
      }
    }
  } catch {
    throw composeError("COMPOSE_PATH_UNKNOWN");
  }
}

/** True for equal paths or descendants, with path-component boundaries. */
export function pathWithin(parent, child) {
  const suffix = relative(parent, child);
  return suffix === "" || (!isAbsolute(suffix) && suffix !== ".." && !suffix.startsWith(`..${sep}`));
}

export function pathsOverlap(a, b) {
  return pathWithin(a, b) || pathWithin(b, a);
}

export function composeService(config, name) {
  const service = config?.services?.[name];
  if (!record(service)) throw composeError("COMPOSE_TARGET_UNKNOWN");
  return service;
}

export function serviceEnvironment(config, name) {
  const environment = composeService(config, name).environment;
  if (!record(environment)) throw composeError("COMPOSE_TARGET_UNKNOWN");
  return environment;
}

/** Select only this service's unique canonical bind, never another service. */
export function bindSource(config, service, target) {
  const volumes = composeService(config, service).volumes;
  if (!Array.isArray(volumes) || volumes.some((entry) => !record(entry) || typeof entry.target !== "string")) throw composeError("COMPOSE_TARGET_UNKNOWN");
  const normalized = (value) => posix.normalize(value).replace(/\/$/, "");
  const wanted = normalized(target);
  const matches = volumes.filter((entry) => normalized(entry.target) === wanted);
  // A nested mount could conceal another shared data source below this bind.
  if (volumes.some((entry) => normalized(entry.target).startsWith(`${wanted}/`))) throw composeError("COMPOSE_TARGET_UNKNOWN");
  const entry = matches[0];
  if (matches.length !== 1 || entry.type !== "bind" || typeof entry.source !== "string" || !isAbsolute(entry.source)) throw composeError("COMPOSE_TARGET_UNKNOWN");
  const physical = physicalPath(entry.source);
  try { if (!statSync(physical).isDirectory()) throw new Error(); }
  catch (error) { if (error.code !== "ENOENT") throw composeError("COMPOSE_PATH_UNKNOWN"); }
  return physical;
}
