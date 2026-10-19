import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const helper = fileURLToPath(new URL("./prepare-production-simulation.py", import.meta.url));
const socket = "/var/run/docker.sock";
const workspaceTarget = "/tmp/pythonlab/workspaces";
const bind = (source, target) => ({ type: "bind", source, target });
const volume = (source, target) => ({ type: "volume", source, target });

function productionConfig() {
  const services = Object.fromEntries([
    "postgres", "redis", "backend", "typst-worker", "pythonlab-worker",
    "pythonlab-sandbox", "frontend", "gateway",
  ].map(name => [name, {
    image: `example/${name}:2.1.5`,
    container_name: `wangsh-${name}`,
    build: { context: "/normal/repository" },
    networks: { "wangsh-network": null },
  }]));
  services.postgres.volumes = [bind("/normal/data/postgres", "/var/lib/postgresql/data")];
  services.redis.volumes = [bind("/normal/data/redis", "/data")];
  services.backend.volumes = [
    volume("typst_pdfs", "/app/data/typst_pdfs"),
    volume("uploads_data", "/app/uploads"),
    bind(socket, socket),
    bind("/normal/data/pythonlab/workspaces", workspaceTarget),
  ];
  services["typst-worker"].volumes = [volume("typst_pdfs", "/app/data/typst_pdfs")];
  services["pythonlab-worker"].volumes = [bind(socket, socket), bind("/normal/data/pythonlab/workspaces", workspaceTarget)];
  services.backend.networks.dify_network = null;
  services.postgres.ports = [{ target: 5432, published: "5432" }];
  services.gateway.ports = [{ target: 80, published: "6608", host_ip: "0.0.0.0" }];
  services.postgres.healthcheck = { test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"] };
  services["typst-worker"].healthcheck = { test: ["CMD-SHELL", "celery inspect ping -d celery@$$HOSTNAME"] };
  services.backend.environment = { SECRET_KEY: "synthetic-secret-value", POSTGRES_HOST: "postgres" };
  services.backend.command = ["sh", "-c", "alembic upgrade head && exec uvicorn main:app"];
  return {
    name: "normal-production",
    services,
    networks: { "wangsh-network": { name: "normal-network" }, dify_network: { name: "docker_default", external: true } },
    volumes: { typst_pdfs: { external: true, name: "real-pdfs" }, uploads_data: { driver: "local", driver_opts: { type: "none", device: "/normal/uploads", o: "bind" } } },
    "x-common-env": { SECRET_KEY: "synthetic-secret-value" },
  };
}

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wangsh-simulation-config-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const workspace = path.join(root, "data/pythonlab/simulations/run.fixture");
  fs.mkdirSync(workspace, { recursive: true });
  const run = (config, changes = {}) => {
    const script = [
      "import importlib.util,json,pathlib,sys",
      "spec=importlib.util.spec_from_file_location('simulation_under_test',sys.argv[1])",
      "module=importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(module)",
      "try:",
      " result=module.prepare_simulation(json.load(sys.stdin),repo_root=pathlib.Path(sys.argv[2]),workspace=sys.argv[3],port=sys.argv[4])",
      "except module.SimulationConfigError:",
      " sys.stderr.write('configuration rejected\\n')",
      " sys.exit(2)",
      "json.dump(result,sys.stdout)",
    ].join("\n");
    return spawnSync("python3", ["-B", "-c", script, helper, root, changes.workspace ?? workspace, String(changes.port ?? 16608)], {
      input: JSON.stringify(config), encoding: "utf8",
    });
  };
  return { root, workspace, run };
}

test("isolates real Compose names, data, networks and ports without changing runtime strings", (t) => {
  const f = fixture(t);
  const input = productionConfig();
  const before = structuredClone(input);
  const result = f.run(input);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.name, "wangsh_sim");
  assert.deepEqual(input, before);
  assert.deepEqual(output.networks, { "wangsh-network": { driver: "bridge" } });
  assert.deepEqual(output.volumes, { simulation_postgres: {}, simulation_redis: {}, typst_pdfs: {}, uploads_data: {} });
  assert.deepEqual(output.services.postgres.volumes, [volume("simulation_postgres", "/var/lib/postgresql/data")]);
  assert.deepEqual(output.services.redis.volumes, [volume("simulation_redis", "/data")]);
  for (const [name, service] of Object.entries(output.services)) {
    assert.ok(!("container_name" in service), name);
    assert.ok(!("build" in service), name);
    assert.deepEqual(service.networks, { "wangsh-network": {} });
    if (name !== "gateway") assert.ok(!("ports" in service), name);
    for (const mount of service.volumes ?? []) {
      if (mount.type !== "bind") continue;
      assert.ok(["backend", "pythonlab-worker"].includes(name));
      assert.ok(mount.source === socket || mount.source === f.workspace);
    }
  }
  assert.deepEqual(output.services.gateway.ports, [{ host_ip: "127.0.0.1", target: 80, published: "16608", protocol: "tcp" }]);
  for (const name of ["postgres", "typst-worker"]) {
    assert.deepEqual(output.services[name].healthcheck, input.services[name].healthcheck);
  }
  assert.deepEqual(output.services.backend.command, input.services.backend.command);
  assert.deepEqual(output.services.backend.environment, input.services.backend.environment);
  assert.ok(!("x-common-env" in output));
});

test("rejects unrecognized, duplicate, missing and malformed mounts", (t) => {
  const f = fixture(t);
  const mutations = [
    c => c.services.backend.volumes.push(bind("/normal/home", "/host")),
    c => c.services.frontend.volumes = [bind(socket, socket)],
    c => c.services.backend.volumes.push(bind(socket, socket)),
    c => c.services.postgres.volumes = [],
    c => c.services.backend.volumes[2].source = "/another/docker.sock",
    c => c.services.backend.volumes[2].type = "volume",
    c => c.services.backend.volumes[3].type = "volume",
    c => c.services.backend.volumes[3].target = "/another/workspace",
    c => c.services.postgres.volumes = ["/normal/data/postgres:/var/lib/postgresql/data"],
    c => c.services.redis.volumes[0].type = "tmpfs",
  ];
  for (const mutate of mutations) {
    const config = productionConfig();
    mutate(config);
    assert.equal(f.run(config).status, 2, mutate.toString());
  }
});

test("rejects extra services and external configuration mechanisms", (t) => {
  const f = fixture(t);
  for (const mutate of [
    c => c.services.surprise = { image: "unknown:latest" },
    c => delete c.services.backend,
    c => c.secrets = {},
    c => c.configs = {},
    c => c.include = ["/normal/compose.yml"],
    c => c.services.backend.secrets = ["sensitive"],
    c => c.services.backend.env_file = ["/normal/.env"],
    c => c.services.backend.network_mode = "host",
    c => c.services.backend.privileged = true,
    c => c.services.backend.volumes_from = ["normal-backend"],
    c => c.services.backend.tmpfs = ["/unknown/target"],
    c => c.services.frontend.use_api_socket = true,
  ]) {
    const config = productionConfig();
    mutate(config);
    assert.equal(f.run(config).status, 2, mutate.toString());
  }
});

test("rejects normal ports, invalid ports and workspaces outside the owned run directory", (t) => {
  const f = fixture(t);
  for (const port of [6608, 8000, 5432, 6379, 0, -1, 65536, "abc", "16608:80", " 16608"]) {
    assert.equal(f.run(productionConfig(), { port }).status, 2, String(port));
  }
  for (const workspace of [
    "data/pythonlab/simulations/run.fixture",
    path.join(f.root, "data/pythonlab/workspaces"),
    path.join(f.root, "data/pythonlab/simulations/fixture"),
    path.join(f.root, "data/pythonlab/simulations/run.missing"),
    path.join(f.workspace, "run.nested"),
  ]) {
    assert.equal(f.run(productionConfig(), { workspace }).status, 2, workspace);
  }
  const link = path.join(f.root, "data/pythonlab/simulations/run.link");
  fs.symlinkSync(f.workspace, link, "dir");
  assert.equal(f.run(productionConfig(), { workspace: link }).status, 2);
});

test("CLI failure does not disclose config, paths, secrets or tracebacks", () => {
  const secret = "never-print-this-synthetic-secret";
  for (const input of [JSON.stringify({ secrets: { [secret]: { file: "/sensitive/.env" } } }), `{"password":"${secret}" invalid`]) {
    const result = spawnSync("python3", ["-B", helper, "--workspace", "/sensitive/run.fixture", "--port", "6608"], { input, encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, new RegExp(`${secret}|/sensitive|Traceback|password`));
    assert.match(result.stderr, /Refusing unsafe or invalid/);
  }
});

test("CLI accepts a fixture repository and rejects unsafe documents without exposing their contents", (t) => {
  const f = fixture(t);
  const scripts = path.join(f.root, "scripts");
  fs.mkdirSync(scripts);
  const fixtureHelper = path.join(scripts, "prepare-production-simulation.py");
  fs.copyFileSync(helper, fixtureHelper);
  const run = input => spawnSync("python3", ["-B", fixtureHelper, "--workspace", f.workspace, "--port", "16608"], { input, encoding: "utf8" });
  const valid = run(JSON.stringify(productionConfig()));
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).name, "wangsh_sim");
  const secret = "secret-that-must-never-be-printed";
  const invalid = productionConfig();
  invalid.secrets = { [secret]: { file: "/sensitive/.env" } };
  for (const input of [JSON.stringify(invalid), `{"${secret}":invalid`]) {
    const result = run(input);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, new RegExp(`${secret}|/sensitive|Traceback`));
  }
});
