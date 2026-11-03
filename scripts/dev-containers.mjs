#!/usr/bin/env node

/**
 * Read-only ownership guard, run before either development startup mode:
 *   node scripts/dev-containers.mjs --root ROOT check
 *
 * No remove/down/up operation exists here. Existing verified dev containers are
 * left to Compose to reuse/recreate; names alone never confer ownership.
 */
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FAILURE_MESSAGE = "Development container ownership check failed; no containers were modified.";
const DEV_COMPOSE = "docker-compose.dev.yml";
const LEGACY_NAMES = ["wangsh-caddy", "wangsh-pythonlab-sandbox"];
const LOCAL_CONTEXTS = new Set(["default", "desktop-linux"]);
const FULL_ID = /^[a-f0-9]{64}$/;
const NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const defaultRoot = fileURLToPath(new URL("../", import.meta.url));
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const deny = () => { throw new Error(FAILURE_MESSAGE); };
const requireThat = (condition) => { if (!condition) deny(); };

function absolute(value) {
  requireThat(typeof value === "string" && path.isAbsolute(value) && !value.includes("\0"));
  return value;
}

function destination(value) {
  requireThat(typeof value === "string" && path.posix.isAbsolute(value) && !value.includes("\0"));
  return path.posix.normalize(value);
}

/** Keep only ownership-relevant fields, never service environments or secrets. */
export function planExpectedContainers(canonical, { root, composeFile, physicalPath } = {}) {
  try {
    requireThat(typeof physicalPath === "function");
    const physicalRoot = physicalPath(absolute(root));
    const physicalCompose = physicalPath(absolute(composeFile));
    requireThat(physicalCompose === physicalPath(path.join(physicalRoot, DEV_COMPOSE)));
    requireThat(record(canonical) && /^[a-z0-9][a-z0-9_-]*$/.test(canonical.name ?? ""));
    requireThat(record(canonical.services) && Object.keys(canonical.services).length > 0);
    const containers = new Map();
    for (const [service, definition] of Object.entries(canonical.services)) {
      requireThat(NAME.test(service) && record(definition));
      const name = definition.container_name;
      requireThat(typeof name === "string" && NAME.test(name) && !containers.has(name));
      const volumes = definition.volumes ?? [];
      requireThat(Array.isArray(volumes));
      const targets = new Set();
      const binds = [];
      for (const volume of volumes) {
        requireThat(record(volume) && typeof volume.type === "string");
        const target = destination(volume.target);
        requireThat(!targets.has(target));
        targets.add(target);
        if (volume.type !== "bind") continue; // Named/anonymous volumes are not host bind evidence.
        requireThat(volume.read_only === undefined || typeof volume.read_only === "boolean");
        binds.push({
          source: physicalPath(absolute(volume.source)),
          target,
          rw: volume.read_only !== true,
        });
      }
      containers.set(name, { service, binds });
    }
    return { project: canonical.name, root: physicalRoot, composeFile: physicalCompose, containers, physicalPath };
  } catch {
    deny();
  }
}

/** Docker's name filter is not exact, so select exact names ourselves. */
export function selectCandidates(psText, plan) {
  try {
    requireThat(typeof psText === "string" && plan.containers instanceof Map);
    const names = new Set([...plan.containers.keys(), ...LEGACY_NAMES]);
    const idsSeen = new Set();
    const namesSeen = new Set();
    const candidates = [];
    for (const line of psText.split(/\r?\n/).filter((value) => value.trim())) {
      const row = JSON.parse(line);
      requireThat(record(row) && typeof row.Names === "string" && FULL_ID.test(row.ID ?? ""));
      const matches = row.Names.split(",").filter((name) => names.has(name));
      requireThat(matches.length <= 1);
      if (!matches.length) continue;
      const name = matches[0];
      requireThat(!idsSeen.has(row.ID) && !namesSeen.has(name));
      idsSeen.add(row.ID);
      namesSeen.add(name);
      candidates.push({ id: row.ID, name });
    }
    return candidates;
  } catch {
    deny();
  }
}

/** A full-ID inspect must prove project, service, source tree, Compose and binds. */
export function validateContainer(container, candidate, plan) {
  try {
    const expected = plan.containers.get(candidate.name);
    requireThat(expected && record(container) && container.Id === candidate.id);
    requireThat(FULL_ID.test(candidate.id) && container.Name === `/${candidate.name}`);
    const labels = container.Config?.Labels;
    requireThat(record(labels));
    requireThat(labels["com.docker.compose.project"] === plan.project);
    requireThat(labels["com.docker.compose.service"] === expected.service);
    requireThat(plan.physicalPath(absolute(labels["com.docker.compose.project.working_dir"])) === plan.root);
    const files = labels["com.docker.compose.project.config_files"];
    requireThat(typeof files === "string" && files.split(",").length === 1);
    requireThat(plan.physicalPath(absolute(files)) === plan.composeFile);

    requireThat(Array.isArray(container.Mounts));
    const targets = new Set();
    const actualBinds = [];
    for (const mount of container.Mounts) {
      requireThat(record(mount) && typeof mount.Type === "string");
      const target = destination(mount.Destination);
      requireThat(!targets.has(target));
      targets.add(target);
      if (mount.Type !== "bind") continue;
      requireThat(typeof mount.RW === "boolean");
      actualBinds.push({ source: plan.physicalPath(absolute(mount.Source)), target, rw: mount.RW });
    }
    // Equality also rejects extra host binds; Adminer legitimately has zero.
    requireThat(actualBinds.length === expected.binds.length);
    for (const bind of expected.binds) {
      requireThat(actualBinds.some((actual) => actual.source === bind.source
        && actual.target === bind.target && actual.rw === bind.rw));
    }
    return true;
  } catch {
    deny();
  }
}

function requireLocalEnvironment(environment) {
  requireThat(record(environment));
  const context = environment.DOCKER_CONTEXT;
  requireThat(!context || LOCAL_CONTEXTS.has(context));
  const host = environment.DOCKER_HOST;
  if (host) requireThat(typeof host === "string" && /^unix:\/\/\/[^\s?#\0]+$/.test(host));
}

function dockerReader(spawn, root, environment) {
  return (args) => {
    const result = spawn("docker", args, {
      cwd: root,
      env: environment,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    // Never attach raw stdout/stderr, command errors, or causes to an exception.
    requireThat(result && !result.error && !result.signal && result.status === 0 && typeof result.stdout === "string");
    return result.stdout;
  };
}

function requireLocalDocker(readDocker, environment) {
  const context = readDocker(["context", "show"]).trim();
  requireThat(LOCAL_CONTEXTS.has(context));
  requireThat(!environment.DOCKER_CONTEXT || environment.DOCKER_CONTEXT === context);
  const contexts = JSON.parse(readDocker(["context", "inspect", context]));
  requireThat(Array.isArray(contexts) && contexts.length === 1 && contexts[0]?.Name === context);
  const host = contexts[0]?.Endpoints?.docker?.Host;
  requireLocalEnvironment({ DOCKER_HOST: host });
  requireThat(typeof host === "string" && host.length > 0);
}

/**
 * Helpers are dynamically loaded so pure tests need neither Compose nor env files.
 * The shared physicalPath resolves the nearest existing ancestor plus missing tail.
 * Injection is for fixture tests, not a CLI escape hatch or alternate daemon.
 */
export async function checkContainers({
  root = defaultRoot,
  environment = process.env,
  helpers,
  spawn = spawnSync,
  exists = existsSync,
} = {}) {
  try {
    requireLocalEnvironment(environment); // Explicit remote targets fail before any subprocess.
    const shared = helpers ?? await import("./compose-config.mjs");
    const { renderCompose, cleanComposeEnvironment, physicalPath } = shared;
    requireThat(typeof renderCompose === "function" && typeof cleanComposeEnvironment === "function"
      && typeof physicalPath === "function" && typeof spawn === "function");
    const dockerEnvironment = cleanComposeEnvironment(environment);
    requireLocalEnvironment(dockerEnvironment);
    // A sanitizer may remove COMPOSE_* overrides, never silently switch Docker targets.
    for (const key of ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"]) {
      requireThat((dockerEnvironment[key] ?? "") === (environment[key] ?? ""));
    }
    const physicalRoot = physicalPath(path.resolve(root));
    const composeFile = path.join(physicalRoot, DEV_COMPOSE);
    const envFile = [path.join(physicalRoot, ".env.dev")];
    requireThat(exists(composeFile) && exists(envFile[0]));
    const local = path.join(physicalRoot, ".env.local");
    if (exists(local)) envFile.push(local);
    const readDocker = dockerReader(spawn, physicalRoot, dockerEnvironment);
    // Inspect the selected local context; never force --context default to hide a remote selection.
    requireLocalDocker(readDocker, dockerEnvironment);
    const canonical = renderCompose({ root: physicalRoot, envFile, composeFile, environment });
    const plan = planExpectedContainers(canonical, { root: physicalRoot, composeFile, physicalPath });
    const candidates = selectCandidates(readDocker(["ps", "-a", "--no-trunc", "--format", "{{json .}}"]), plan);
    if (candidates.length) {
      const inspected = JSON.parse(readDocker(["inspect", "--type", "container", ...candidates.map(({ id }) => id)]));
      requireThat(Array.isArray(inspected) && inspected.length === candidates.length);
      const byId = new Map();
      for (const container of inspected) {
        requireThat(record(container) && FULL_ID.test(container.Id ?? "") && !byId.has(container.Id));
        byId.set(container.Id, container);
      }
      // One batch captures every candidate; only a complete validation can return success.
      for (const candidate of candidates) validateContainer(byId.get(candidate.id), candidate, plan);
    }
    return { checked: candidates.length };
  } catch {
    deny();
  }
}

/** Exit 0 only after the complete read-only preflight; all failures use one message. */
export async function runCli(argv = process.argv.slice(2), options = {}) {
  const { stdout = process.stdout, stderr = process.stderr } = options;
  try {
    let root = defaultRoot;
    let command;
    let hasRoot = false;
    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];
      if (arg === "--root") {
        requireThat(!hasRoot && typeof argv[index + 1] === "string" && !argv[index + 1].startsWith("--"));
        root = argv[++index];
        hasRoot = true;
      } else {
        requireThat(arg === "check" && !command);
        command = arg;
      }
    }
    requireThat(command === "check" && root.length > 0);
    const { checked } = await checkContainers({ ...options, root });
    stdout.write(`Development container ownership check passed (${checked} containers); no containers were modified.\n`);
    return 0;
  } catch {
    stderr.write(`${FAILURE_MESSAGE}\n`);
    return 1;
  }
}

// Node resolves the module URL through symlinks (including macOS /var -> /private/var).
// Compare the physical entry file so a symlinked checkout cannot silently skip the guard.
let isEntry = false;
try {
  isEntry = Boolean(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
} catch {
  // Imported modules may have a non-file argv[1] (for example node --eval).
}
if (isEntry) process.exitCode = await runCli();
