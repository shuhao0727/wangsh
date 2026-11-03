import assert from "node:assert/strict";
import childProcess, { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as guard from "./dev-containers.mjs";


const ROOT = "/synthetic/wangsh";
const COMPOSE = "docker-compose.dev.yml";
const FAILURE = "Development container ownership check failed; no containers were modified.";
const normalize = (value) => path.resolve(value);
const idFor = (index) => (index + 1).toString(16).padStart(64, "0");
const bind = (source, target, readOnly = false) => ({
  type: "bind", source, target, read_only: readOnly,
});

function canonicalFixture(root = ROOT) {
  return {
    name: "wangsh-dev",
    services: {
      postgres: {
        container_name: "wangsh-postgres",
        volumes: [bind(`${root}/data/dev/postgres`, "/var/lib/postgresql/data")],
      },
      redis: {
        container_name: "wangsh-redis",
        volumes: [bind(`${root}/data/dev/redis`, "/data")],
      },
      adminer: { container_name: "wangsh-adminer" },
      backend: {
        container_name: "wangsh-backend",
        environment: { SECRET_KEY: "SYNTHETIC_CANONICAL_SECRET" },
        volumes: [
          bind(`${root}/backend`, "/app"),
          bind(`${root}/data/dev/uploads`, "/app/uploads"),
          bind(`${root}/data/dev/typst_pdfs`, "/app/data/typst_pdfs"),
          bind(`${root}/data/dev/pythonlab/workspaces`, "/tmp/pythonlab/workspaces"),
          bind("/synthetic/docker.sock", "/var/run/docker.sock"),
        ],
      },
      "typst-worker": {
        container_name: "wangsh-typst-worker",
        volumes: [
          bind(`${root}/backend`, "/app"),
          bind(`${root}/data/dev/typst_pdfs`, "/app/data/typst_pdfs"),
        ],
      },
      "pythonlab-worker": {
        container_name: "wangsh-pythonlab-worker",
        volumes: [
          bind(`${root}/backend`, "/app"),
          bind(`${root}/data/dev/pythonlab/workspaces`, "/tmp/pythonlab/workspaces"),
          bind("/synthetic/docker.sock", "/var/run/docker.sock"),
        ],
      },
      frontend: {
        container_name: "wangsh-frontend",
        volumes: [
          bind(`${root}/frontend`, "/app"),
          { type: "volume", target: "/app/node_modules" },
        ],
      },
    },
  };
}

function planFor(canonical = canonicalFixture(), options = {}) {
  return guard.planExpectedContainers(canonical, {
    root: ROOT,
    composeFile: path.join(ROOT, COMPOSE),
    physicalPath: normalize,
    ...options,
  });
}

function containerFixture(service, canonical = canonicalFixture(), root = ROOT) {
  const definition = canonical.services[service];
  return {
    Id: idFor(Object.keys(canonical.services).indexOf(service)),
    Name: `/${definition.container_name}`,
    Config: {
      Env: ["SYNTHETIC_INSPECT_SECRET=DO_NOT_PRINT_FIXTURE"],
      Labels: {
        "com.docker.compose.project": canonical.name,
        "com.docker.compose.service": service,
        "com.docker.compose.project.working_dir": root,
        "com.docker.compose.project.config_files": path.join(root, COMPOSE),
      },
    },
    Mounts: (definition.volumes ?? []).map((volume) => ({
      Type: volume.type,
      Source: volume.source ?? "/synthetic/anonymous-volume",
      Destination: volume.target,
      RW: !volume.read_only,
    })),
  };
}

const candidateFor = (container) => ({ id: container.Id, name: container.Name.slice(1) });
const listingFor = (containers) => containers.map((container) => JSON.stringify({
  ID: container.Id, Names: container.Name.slice(1),
})).join("\n");
const denied = (operation) => assert.throws(operation, { message: FAILURE });

// Pure tests run before a shared Compose helper or Docker executable is needed.
test("canonical project and explicit container names define every expected service", () => {
  const canonical = canonicalFixture();
  const plan = planFor(canonical);
  assert.equal(plan.project, canonical.name);
  assert.equal(plan.root, ROOT);
  assert.equal(plan.composeFile, path.join(ROOT, COMPOSE));
  assert.equal(plan.containers.size, Object.keys(canonical.services).length);
  assert.equal(plan.containers.get("wangsh-backend").service, "backend");
  assert.equal(plan.containers.get("wangsh-backend").binds.length, 5);
  assert.equal(plan.containers.get("wangsh-adminer").binds.length, 0);
});

test("missing canonical identity or duplicate container names fail closed", () => {
  const missingProject = canonicalFixture();
  delete missingProject.name;
  denied(() => planFor(missingProject));
  const missingName = canonicalFixture();
  delete missingName.services.adminer.container_name;
  denied(() => planFor(missingName));
  const duplicate = canonicalFixture();
  duplicate.services.adminer.container_name = "wangsh-postgres";
  denied(() => planFor(duplicate));
});

test("candidate selection uses exact names and full immutable IDs, including legacy names", () => {
  const postgres = containerFixture("postgres");
  const rows = [
    postgres,
    { Id: idFor(30), Name: "/wangsh-postgres-copy" },
    { Id: idFor(31), Name: "/other-wangsh-backend" },
    { Id: idFor(32), Name: "/wangsh-caddy" },
    { Id: idFor(33), Name: "/wangsh-pythonlab-sandbox" },
  ];
  assert.deepEqual(guard.selectCandidates(listingFor(rows), planFor()), [
    candidateFor(postgres), candidateFor(rows[3]), candidateFor(rows[4]),
  ]);
});

test("normal dev containers pass, including Adminer without bind mounts", () => {
  const canonical = canonicalFixture();
  const plan = planFor(canonical);
  for (const service of Object.keys(canonical.services)) {
    const container = containerFixture(service, canonical);
    assert.equal(guard.validateContainer(container, candidateFor(container), plan), true);
  }
});

test("a same-name production container or other-root container is denied", () => {
  const production = containerFixture("postgres");
  production.Config.Labels["com.docker.compose.project.config_files"] = `${ROOT}/docker-compose.yml`;
  denied(() => guard.validateContainer(production, candidateFor(production), planFor()));
  const otherRoot = containerFixture("redis");
  otherRoot.Config.Labels["com.docker.compose.project.working_dir"] = "/synthetic/other-tree";
  denied(() => guard.validateContainer(otherRoot, candidateFor(otherRoot), planFor()));
  const otherProject = containerFixture("adminer");
  otherProject.Config.Labels["com.docker.compose.project"] = "production";
  denied(() => guard.validateContainer(otherProject, candidateFor(otherProject), planFor()));
});

test("each ownership label is mandatory, exact, and limited to the dev Compose file", () => {
  for (const label of Object.keys(containerFixture("backend").Config.Labels)) {
    const container = containerFixture("backend");
    delete container.Config.Labels[label];
    denied(() => guard.validateContainer(container, candidateFor(container), planFor()));
  }
  for (const [label, value] of [
    ["com.docker.compose.service", "unknown"],
    ["com.docker.compose.project.working_dir", "relative-root"],
    ["com.docker.compose.project.config_files", `${ROOT}/${COMPOSE},${ROOT}/docker-compose.yml`],
    ["com.docker.compose.project.config_files", COMPOSE],
  ]) {
    const container = containerFixture("backend");
    container.Config.Labels[label] = value;
    denied(() => guard.validateContainer(container, candidateFor(container), planFor()));
  }
});

test("every bind source, destination, and RW flag is verified, not just the database", () => {
  const canonical = canonicalFixture();
  for (const service of Object.keys(canonical.services)) {
    const valid = containerFixture(service, canonical);
    for (let index = 0; index < valid.Mounts.length; index += 1) {
      if (valid.Mounts[index].Type !== "bind") continue;
      for (const [key, value] of [
        ["Source", "/synthetic/production-data"],
        ["Destination", "/wrong-destination"],
        ["RW", false],
      ]) {
        const container = structuredClone(valid);
        container.Mounts[index][key] = value;
        denied(() => guard.validateContainer(container, candidateFor(container), planFor(canonical)));
      }
    }
  }
});

test("named and anonymous volumes are ignored but cannot replace a canonical bind", () => {
  const frontend = containerFixture("frontend");
  frontend.Mounts.push({ Type: "volume", Source: "/irrelevant/volume", Destination: "/cache", RW: true });
  assert.equal(guard.validateContainer(frontend, candidateFor(frontend), planFor()), true);
  const backend = containerFixture("backend");
  backend.Mounts[1].Type = "volume";
  denied(() => guard.validateContainer(backend, candidateFor(backend), planFor()));
});

test("read-only canonical binds are accepted only as read-only inspect mounts", () => {
  const canonical = canonicalFixture();
  canonical.services.backend.volumes[0].read_only = true;
  const backend = containerFixture("backend", canonical);
  assert.equal(guard.validateContainer(backend, candidateFor(backend), planFor(canonical)), true);
  backend.Mounts[0].RW = true;
  denied(() => guard.validateContainer(backend, candidateFor(backend), planFor(canonical)));
});

test("unmapped legacy names are denied rather than being assumed safe to remove", () => {
  for (const name of ["wangsh-caddy", "wangsh-pythonlab-sandbox"]) {
    const container = containerFixture("adminer");
    container.Name = `/${name}`;
    denied(() => guard.validateContainer(container, candidateFor(container), planFor()));
  }
  const canonical = canonicalFixture();
  canonical.services.caddy = {
    container_name: "wangsh-caddy",
    volumes: [bind(`${ROOT}/gateway/Caddyfile.dev`, "/etc/caddy/Caddyfile", true)],
  };
  const caddy = containerFixture("caddy", canonical);
  assert.equal(guard.validateContainer(caddy, candidateFor(caddy), planFor(canonical)), true);
});

test("unexpected binds, missing mounts, and changed inspect identity are denied", () => {
  const adminer = containerFixture("adminer");
  adminer.Mounts.push({ Type: "bind", Source: "/synthetic/prod", Destination: "/data", RW: true });
  denied(() => guard.validateContainer(adminer, candidateFor(adminer), planFor()));
  const missing = containerFixture("postgres");
  missing.Mounts = [];
  denied(() => guard.validateContainer(missing, candidateFor(missing), planFor()));
  const changed = containerFixture("redis");
  denied(() => guard.validateContainer(changed, { ...candidateFor(changed), id: idFor(99) }, planFor()));
  denied(() => guard.validateContainer(changed, { ...candidateFor(changed), name: "wangsh-backend" }, planFor()));
});

test("malformed listing and truncated or duplicate candidate identities fail closed", () => {
  const plan = planFor();
  for (const text of [
    "not-json",
    JSON.stringify({ Names: "wangsh-postgres", ID: "0123abcd" }),
    `${listingFor([containerFixture("redis")])}\n${listingFor([containerFixture("redis")])}`,
  ]) denied(() => guard.selectCandidates(text, plan));
  assert.deepEqual(guard.selectCandidates("", plan), []);
});

function fakeDocker(containers, options = {}) {
  const calls = [];
  const context = options.context ?? "default";
  const endpoint = options.endpoint ?? "unix:///synthetic/docker.sock";
  const spawn = (command, args, spawnOptions) => {
    calls.push({ command, args: [...args], options: spawnOptions });
    assert.equal(command, "docker");
    assert.deepEqual(spawnOptions.stdio, ["ignore", "pipe", "pipe"]);
    assert.equal(spawnOptions.cwd, options.root ?? ROOT);
    assert.equal(spawnOptions.encoding, "utf8");
    const success = (stdout) => ({ status: 0, stdout, stderr: "SYNTHETIC_RAW_STDERR_SECRET" });
    if (args[0] === "context" && args[1] === "show") return success(`${context}\n`);
    if (args[0] === "context" && args[1] === "inspect") {
      assert.deepEqual(args, ["context", "inspect", context]);
      return success(JSON.stringify([{ Name: context, Endpoints: { docker: { Host: endpoint } } }]));
    }
    if (args[0] === "ps") {
      assert.deepEqual(args, ["ps", "-a", "--no-trunc", "--format", "{{json .}}"]);
      if (options.failPs) return { status: 1, stdout: "SYNTHETIC_PS_SECRET", stderr: "SYNTHETIC_RAW_STDERR_SECRET" };
      return success(options.psText ?? listingFor(containers));
    }
    if (args[0] === "inspect") {
      const ids = args.slice(3);
      assert.deepEqual(args.slice(0, 3), ["inspect", "--type", "container"]);
      assert.ok(ids.every((id) => /^[a-f0-9]{64}$/.test(id)));
      if (options.failInspect) {
        return { status: 1, stdout: "SYNTHETIC_INSPECT_STDOUT_SECRET", stderr: "SYNTHETIC_RAW_STDERR_SECRET" };
      }
      return success(options.inspectText ?? JSON.stringify(containers.filter(({ Id }) => ids.includes(Id)).reverse()));
    }
    assert.fail(`unexpected Docker operation: ${args[0]}`);
  };
  return { calls, spawn };
}

function injectedHelpers(canonical = canonicalFixture()) {
  const renders = [];
  const helper = {
    physicalPath: normalize,
    cleanComposeEnvironment(environment) {
      return Object.fromEntries(Object.entries(environment).filter(([key]) => !key.startsWith("COMPOSE_")
        && !["POSTGRES_PASSWORD", "SECRET_KEY"].includes(key)));
    },
    renderCompose(options) {
      renders.push(options);
      return canonical;
    },
  };
  return { helper, renders };
}

function cliFixture(containers = Object.keys(canonicalFixture().services).map((service) => containerFixture(service)), options = {}) {
  const fake = fakeDocker(containers, options);
  const shared = injectedHelpers(options.canonical);
  let stdout = "";
  let stderr = "";
  const configuration = {
    environment: {},
    exists: (file) => file === `${ROOT}/${COMPOSE}` || file === `${ROOT}/.env.dev`,
    helpers: shared.helper,
    spawn: fake.spawn,
    stdout: { write: (text) => { stdout += text; } },
    stderr: { write: (text) => { stderr += text; } },
    ...options.guardOptions,
  };
  return {
    ...fake,
    ...shared,
    configuration,
    run: (argv = ["--root", ROOT, "check"]) => guard.runCli(argv, configuration),
    output: () => ({ stdout, stderr }),
  };
}

function onlyReadOperations(calls) {
  assert.ok(calls.every(({ args }) => ["context", "ps", "inspect"].includes(args[0])));
  assert.ok(!calls.some(({ args }) => args.some((arg) => ["rm", "down", "up", "stop", "kill", "restart"].includes(arg))));
}

function assertCliDenied(fixture) {
  const output = fixture.output();
  assert.equal(output.stdout, "");
  assert.equal(output.stderr, `${FAILURE}\n`);
  onlyReadOperations(fixture.calls);
}

test("CLI performs a complete read-only check and canonical render with ordered dev env files", async () => {
  const environment = { PATH: "/synthetic/bin", COMPOSE_FILE: "/synthetic/prod.yml", SECRET_KEY: "SYNTHETIC_PROCESS_SECRET" };
  const fixture = cliFixture(undefined, {
    guardOptions: { environment, exists: () => true },
  });
  assert.equal(await fixture.run(), 0);
  assert.equal(fixture.output().stderr, "");
  assert.match(fixture.output().stdout, /passed \(7 containers\)/);
  assert.deepEqual(fixture.renders, [{
    root: ROOT, envFile: [`${ROOT}/.env.dev`, `${ROOT}/.env.local`],
    composeFile: `${ROOT}/${COMPOSE}`, environment,
  }]);
  const inspect = fixture.calls.find(({ args }) => args[0] === "inspect");
  assert.equal(inspect.args.length - 3, 7);
  for (const { options } of fixture.calls) {
    assert.equal(options.env.COMPOSE_FILE, undefined);
    assert.equal(options.env.SECRET_KEY, undefined);
  }
  onlyReadOperations(fixture.calls);
});

test("CLI passes with no candidates and never inspects unrelated containers", async () => {
  const fixture = cliFixture([{ Id: idFor(40), Name: "/wangsh-postgres-not-exact" }]);
  assert.equal(await fixture.run(), 0);
  assert.match(fixture.output().stdout, /passed \(0 containers\)/);
  assert.equal(fixture.renders[0].envFile.length, 1);
  assert.equal(fixture.calls.some(({ args }) => args[0] === "inspect"), false);
  onlyReadOperations(fixture.calls);
});

test("same-name production, other-root, missing-label, wrong-mount and legacy collisions deny CLI", async () => {
  const mutations = [
    (container) => { container.Config.Labels["com.docker.compose.project.config_files"] = `${ROOT}/docker-compose.yml`; },
    (container) => { container.Config.Labels["com.docker.compose.project.working_dir"] = "/synthetic/other-tree"; },
    (container) => { delete container.Config.Labels["com.docker.compose.service"]; },
    (container) => { container.Mounts[0].Source = `${ROOT}/data/postgres`; },
    (container) => { container.Name = "/wangsh-pythonlab-sandbox"; },
  ];
  for (const mutate of mutations) {
    const container = containerFixture("postgres");
    mutate(container);
    const fixture = cliFixture([container]);
    assert.equal(await fixture.run(), 1);
    assertCliDenied(fixture);
  }
});

test("all candidates are inspected before any success, including an unsafe final candidate", async () => {
  const containers = Object.keys(canonicalFixture().services).map((service) => containerFixture(service));
  containers.at(-1).Mounts[0].Source = "/synthetic/other-tree/frontend";
  const fixture = cliFixture(containers);
  assert.equal(await fixture.run(), 1);
  assertCliDenied(fixture);
  const inspectCalls = fixture.calls.filter(({ args }) => args[0] === "inspect");
  assert.equal(inspectCalls.length, 1);
  assert.deepEqual(new Set(inspectCalls[0].args.slice(3)), new Set(containers.map(({ Id }) => Id)));
});

test("failed or malformed inspect cannot leak raw config, stderr, errors, or any success", async () => {
  for (const options of [
    { failInspect: true },
    { inspectText: "SYNTHETIC_MALFORMED_INSPECT_SECRET" },
    { inspectText: "[]" },
    { inspectText: JSON.stringify([containerFixture("redis")]) },
  ]) {
    const fixture = cliFixture([containerFixture("postgres")], options);
    assert.equal(await fixture.run(), 1);
    assertCliDenied(fixture);
  }
  const fixture = cliFixture();
  fixture.configuration.spawn = () => { throw new Error("SYNTHETIC_SPAWN_ERROR_SECRET"); };
  assert.equal(await fixture.run(), 1);
  assertCliDenied(fixture);
});

test("ps failures, missing dev configuration, and rendering errors fail closed without changes", async () => {
  const failedPs = cliFixture(undefined, { failPs: true });
  assert.equal(await failedPs.run(), 1);
  assertCliDenied(failedPs);
  for (const missing of [COMPOSE, ".env.dev"]) {
    const fixture = cliFixture(undefined, { guardOptions: { exists: (file) => !file.endsWith(`/${missing}`) } });
    assert.equal(await fixture.run(), 1);
    assert.equal(fixture.calls.length, 0);
    assertCliDenied(fixture);
  }
  const renderFailure = cliFixture();
  renderFailure.helper.renderCompose = () => { throw new Error("SYNTHETIC_RENDER_SECRET"); };
  assert.equal(await renderFailure.run(), 1);
  assertCliDenied(renderFailure);
  assert.equal(renderFailure.calls.some(({ args }) => args[0] === "ps"), false);
});

test("explicit ssh/tcp/http Docker hosts and unapproved contexts deny before any subprocess", async () => {
  for (const environment of [
    { DOCKER_HOST: "ssh://synthetic.invalid" },
    { DOCKER_HOST: "tcp://127.0.0.1:2375" },
    { DOCKER_HOST: "https://synthetic.invalid" },
    { DOCKER_CONTEXT: "production" },
    { DOCKER_CONTEXT: "colima" },
    { DOCKER_CONTEXT: "default", DOCKER_HOST: "ssh://synthetic.invalid" },
  ]) {
    const fixture = cliFixture(undefined, { guardOptions: { environment } });
    assert.equal(await fixture.run(), 1);
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.renders.length, 0);
    assertCliDenied(fixture);
  }
});

test("a remotely selected or redefined context is refused without switching daemons", async () => {
  for (const options of [
    { context: "production" },
    { context: "default", endpoint: "tcp://synthetic.invalid:2375" },
    { context: "desktop-linux", endpoint: "ssh://synthetic.invalid" },
    { context: "default", endpoint: "" },
  ]) {
    const fixture = cliFixture(undefined, options);
    assert.equal(await fixture.run(), 1);
    assert.equal(fixture.renders.length, 0);
    assert.equal(fixture.calls.some(({ args }) => args[0] === "ps"), false);
    assert.ok(fixture.calls.every(({ args }) => !args.includes("--context") && !args.includes("use")));
    assertCliDenied(fixture);
  }
});

test("explicit local default, desktop-linux and unix socket targets are preserved", async () => {
  for (const [context, environment] of [
    ["default", { DOCKER_CONTEXT: "default" }],
    ["desktop-linux", { DOCKER_CONTEXT: "desktop-linux" }],
    ["default", { DOCKER_HOST: "unix:///synthetic/custom.sock" }],
    ["desktop-linux", { DOCKER_CONTEXT: "desktop-linux", DOCKER_CONFIG: "/synthetic/docker-config" }],
  ]) {
    const fixture = cliFixture([], { context, guardOptions: { environment } });
    assert.equal(await fixture.run(), 0);
    for (const { options } of fixture.calls) assert.deepEqual(options.env, environment);
    assert.equal(fixture.renders[0].environment, environment);
  }
  const fixture = cliFixture([], { guardOptions: { environment: { DOCKER_CONTEXT: "desktop-linux" } } });
  fixture.helper.cleanComposeEnvironment = () => ({});
  assert.equal(await fixture.run(), 1);
  assert.equal(fixture.calls.length, 0);
  assertCliDenied(fixture);
});

test("CLI supports only check and rejects remove or malformed arguments before Docker", async () => {
  for (const argv of [
    [], ["remove"], ["--root", ROOT, "remove"], ["--root"], ["check", "unknown"],
    ["--root", ROOT, "--root", ROOT, "check"], ["check", "check"],
  ]) {
    const fixture = cliFixture();
    assert.equal(await fixture.run(argv), 1);
    assert.equal(fixture.calls.length, 0);
    assertCliDenied(fixture);
  }
});

test("default spawn binding can be patched with a read-only fixture fake", async (t) => {
  const fake = fakeDocker([containerFixture("adminer")]);
  const original = childProcess.spawnSync;
  childProcess.spawnSync = fake.spawn;
  syncBuiltinESMExports();
  t.after(() => { childProcess.spawnSync = original; syncBuiltinESMExports(); });
  const { helper } = injectedHelpers();
  assert.deepEqual(await guard.checkContainers({
    root: ROOT, environment: {}, helpers: helper,
    exists: (file) => file === `${ROOT}/${COMPOSE}` || file === `${ROOT}/.env.dev`,
  }), { checked: 1 });
  onlyReadOperations(fake.calls);
});

test("actual CLI loads a local helper stub and patched Docker, never real env or Docker", (t) => {
  const aliasRoot = mkdtempSync(path.join(os.tmpdir(), "wangsh-dev-containers-"));
  const root = realpathSync(aliasRoot);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "scripts"));
  copyFileSync(new URL("./dev-containers.mjs", import.meta.url), path.join(root, "scripts/dev-containers.mjs"));
  const marker = "SYNTHETIC_ENV_ONLY_SECRET";
  writeFileSync(path.join(root, ".env.dev"), `SECRET_KEY=${marker}\n`);
  writeFileSync(path.join(root, ".env.local"), "LOCAL_FIXTURE=only\n");
  writeFileSync(path.join(root, COMPOSE), "# synthetic Compose fixture only\n");
  const canonical = canonicalFixture(root);
  const containers = Object.keys(canonical.services).map((service) => containerFixture(service, canonical, root));
  const fixturePath = path.join(root, "docker-fixture.json");
  const fixtureData = {
    canonical, containers, listing: listingFor(containers), failInspect: false, endpoint: "unix:///synthetic/docker.sock",
  };
  writeFileSync(fixturePath, JSON.stringify(fixtureData));
  const trace = path.join(root, "trace.jsonl");
  writeFileSync(path.join(root, "scripts/compose-config.mjs"), `
import fs from "node:fs";
import path from "node:path";
export const physicalPath = (value) => fs.existsSync(value) ? fs.realpathSync(value) : path.resolve(value);
export const cleanComposeEnvironment = (environment) => ({ PATH: environment.PATH });
export function renderCompose(options) {
  const root = options.root;
  if (JSON.stringify(options.envFile) !== JSON.stringify([path.join(root, ".env.dev"), path.join(root, ".env.local")])) {
    throw new Error("SYNTHETIC_BAD_ENV_ORDER_SECRET");
  }
  if (options.composeFile !== path.join(root, "${COMPOSE}")) throw new Error("bad compose");
  fs.appendFileSync(path.join(root, "trace.jsonl"), JSON.stringify({ render: true }) + "\\n");
  return JSON.parse(fs.readFileSync(path.join(root, "docker-fixture.json"), "utf8")).canonical;
}
`);
  const preload = path.join(root, "fake-docker-preload.cjs");
  writeFileSync(preload, `
const fs = require("node:fs");
const cp = require("node:child_process");
const path = require("node:path");
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "docker-fixture.json"), "utf8"));
cp.spawnSync = (command, args, options) => {
  fs.appendFileSync(path.join(__dirname, "trace.jsonl"), JSON.stringify({ command, args }) + "\\n");
  if (command !== "docker" || !["context", "ps", "inspect"].includes(args[0])) {
    throw new Error("SYNTHETIC_UNSAFE_OPERATION_SECRET");
  }
  if (options.cwd !== __dirname || options.stdio.join(",") !== "ignore,pipe,pipe") throw new Error("unsafe spawn");
  const success = (stdout) => ({ status: 0, stdout, stderr: "SYNTHETIC_RAW_DOCKER_SECRET" });
  if (args[0] === "context" && args[1] === "show") return success("default\\n");
  if (args[0] === "context" && args[1] === "inspect") {
    return success(JSON.stringify([{ Name: "default", Endpoints: { docker: { Host: fixture.endpoint } } }]));
  }
  if (args[0] === "ps") return success(fixture.listing);
  if (args[0] === "inspect" && fixture.failInspect) {
    return { status: 1, stdout: "SYNTHETIC_INSPECT_STDOUT_SECRET", stderr: "SYNTHETIC_RAW_DOCKER_SECRET" };
  }
  if (args[0] === "inspect") return success(JSON.stringify(fixture.containers));
  throw new Error("SYNTHETIC_UNHANDLED_COMMAND_SECRET");
};
require("node:module").syncBuiltinESMExports();
`);
  const run = () => spawnSync(process.execPath, [
    "--require", preload, path.join(aliasRoot, "scripts/dev-containers.mjs"), "--root", aliasRoot, "check",
  ], { cwd: root, env: { PATH: "/synthetic/no-docker-binary" }, encoding: "utf8" });
  const success = run();
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /passed \(7 containers\)/);
  assert.equal(success.stderr, "");
  fixtureData.failInspect = true;
  writeFileSync(fixturePath, JSON.stringify(fixtureData));
  const failure = run();
  assert.equal(failure.status, 1);
  assert.equal(failure.stdout, "");
  assert.equal(failure.stderr, `${FAILURE}\n`);
  const calls = readFileSync(trace, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(calls.filter(({ render }) => render).length, 2);
  onlyReadOperations(calls.filter(({ command }) => command === "docker"));
  assert.equal(readFileSync(path.join(root, ".env.dev"), "utf8"), `SECRET_KEY=${marker}\n`);
});

test("shared render, sanitized local Docker environment and physicalPath integrate on synthetic files", async (t) => {
  const shared = await import("./compose-config.mjs");
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "wangsh-guard-shared-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const alias = path.join(root, "tree-alias");
  symlinkSync(root, alias, "dir");
  writeFileSync(path.join(root, COMPOSE), "# synthetic Compose only\n");
  writeFileSync(path.join(root, ".env.dev"), "SECRET_KEY=SYNTHETIC_SHARED_DEV_SECRET\n");
  writeFileSync(path.join(root, ".env.local"), "LOCAL_FIXTURE=only\n");
  const canonical = canonicalFixture(root);
  // A nonexisting tail under a symlink must still compare by physical ancestry.
  canonical.services.postgres.volumes[0].source = `${alias}/data/dev/postgres`;
  const containers = Object.keys(canonical.services).map((service) => containerFixture(service, canonical, root));
  containers[0].Mounts[0].Source = `${root}/data/dev/postgres`;
  containers[0].Config.Labels["com.docker.compose.project.working_dir"] = alias;
  containers[0].Config.Labels["com.docker.compose.project.config_files"] = `${alias}/${COMPOSE}`;
  const originalEnvironment = process.env;
  const originalSpawn = childProcess.spawnSync;
  t.after(() => { process.env = originalEnvironment; childProcess.spawnSync = originalSpawn; syncBuiltinESMExports(); });
  for (const [context, selection] of [
    ["default", { DOCKER_CONTEXT: "default" }],
    ["desktop-linux", { DOCKER_CONTEXT: "desktop-linux" }],
    ["default", { DOCKER_HOST: "unix:///synthetic/custom.sock" }],
  ]) {
    const environment = {
      PATH: "/synthetic/no-docker", ...selection,
      COMPOSE_PROJECT_NAME: "must-not-affect-canonical", SECRET_KEY: "SYNTHETIC_INHERITED_SECRET",
    };
    process.env = environment;
    const fake = fakeDocker(containers, { context, root });
    const composeCalls = [];
    childProcess.spawnSync = (command, args, options) => {
      if (args[0] !== "compose") return fake.spawn(command, args, options);
      composeCalls.push({ command, args, options });
      assert.equal(command, "docker");
      assert.deepEqual(args, [
        "compose", "--env-file", `${root}/.env.dev`, "--env-file", `${root}/.env.local`,
        "-f", `${root}/${COMPOSE}`, "config", "--format", "json",
      ]);
      assert.equal(options.env.COMPOSE_PROJECT_NAME, undefined);
      for (const [key, value] of Object.entries(selection)) assert.equal(options.env[key], value);
      return { status: 0, stdout: JSON.stringify(canonical), stderr: "SYNTHETIC_COMPOSE_STDERR_SECRET" };
    };
    syncBuiltinESMExports();
    assert.deepEqual(await guard.checkContainers({ root: alias, environment, helpers: shared }), { checked: 7 });
    assert.equal(composeCalls.length, 1);
    onlyReadOperations(fake.calls);
    for (const { options } of fake.calls) {
      for (const [key, value] of Object.entries(selection)) assert.equal(options.env[key], value);
      assert.equal(options.env.COMPOSE_PROJECT_NAME, undefined);
      assert.equal(options.env.SECRET_KEY, undefined);
    }
  }
});
