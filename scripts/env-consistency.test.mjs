import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = fileURLToPath(new URL("./check-env-consistency.mjs", import.meta.url));
const helperUrl = new URL("./compose-config.mjs", import.meta.url);
// Deliberately synthetic, never copied from a real env file.
const PROD = { SECRET_KEY: "fixture-prod-jwt-NOT-REAL", AGENT_API_KEY_ENCRYPTION_KEY: "fixture-prod-fernet-NOT-REAL" };
const DEV = { SECRET_KEY: "fixture-dev-jwt-NOT-REAL", AGENT_API_KEY_ENCRYPTION_KEY: "fixture-dev-fernet-NOT-REAL" };
const PERSONAL = { SECRET_KEY: "fixture-personal-jwt-NOT-REAL", AGENT_API_KEY_ENCRYPTION_KEY: "fixture-personal-fernet-NOT-REAL" };
const PRIVATE_DIAGNOSTIC = "fixture-credential-in-docker-diagnostic-NOT-REAL";
const BUSINESS_KEYS = ["POSTGRES_DB", "POSTGRES_HOST", "POSTGRES_PORT", "DATABASE_URL", ...Object.keys(PROD), "COMPOSE_FILE", "COMPOSE_ENV_FILES", "NODE_OPTIONS"];
const envText = (keys) => Object.entries(keys).map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
const composeText = (pg, redis = "./data/dev/redis") => `services:\n  postgres:\n    volumes:\n      - ${pg}:/var/lib/postgresql/data\n  redis:\n    volumes:\n      - ${redis}:/data\n`;
const bind = (source, target) => ({ type: "bind", source, target });

function model(root, { dev = false, keys = dev ? DEV : PROD, pg, redis, db = "fixture_db", published = "5433" } = {}) {
  return {
    services: {
      postgres: {
        environment: { POSTGRES_DB: db },
        volumes: [bind(pg ?? path.join(root, dev ? "data/dev/postgres" : "data/postgres"), "/var/lib/postgresql/data")],
        ports: dev ? [{ target: 5432, published, protocol: "tcp", host_ip: "0.0.0.0" }] : [],
      },
      redis: { volumes: [bind(redis ?? path.join(root, dev ? "data/dev/redis" : "data/redis"), "/data")] },
      backend: { environment: { ...keys, POSTGRES_HOST: "postgres", POSTGRES_PORT: "5432", POSTGRES_DB: db } },
    },
  };
}

function effective(keys = DEV, { port = "5433", db = "fixture_db", host = "127.0.0.1" } = {}) {
  return {
    ...keys, POSTGRES_HOST: host, POSTGRES_PORT: port, POSTGRES_DB: db,
    DATABASE_URL: `postgresql+asyncpg://fixture:fixture-password@${host}:${port}/${db}`,
  };
}

/**
 * Only the temporary fake executable can run. It accepts exact config argv and
 * checks the child's environment; every unknown invocation exits nonzero.
 * The returned JSON is a mock canonical model, NOT a Docker/YAML parser test.
 */
function fixture(options, inspect) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wangsh-env-consistency-"));
  const put = (name, content) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  try {
    const a = options.composeA ?? "docker-compose.yml";
    const b = options.composeB ?? "docker-compose.dev.yml";
    if (!options.missingProd) put(".env", envText(options.prodKeys ?? PROD));
    if (!options.missingDev) put(".env.dev", envText(options.devKeys ?? DEV));
    put(a, options.yamlA ?? composeText("./data/postgres", "./data/redis"));
    put(b, options.yamlB ?? composeText("./data/dev/postgres"));
    if (options.localFile !== undefined) put(".env.local", options.localFile);
    const prod = model(root, { keys: options.prodKeys ?? PROD });
    const dev = model(root, { dev: true, keys: options.devKeys ?? DEV });
    options.prepare?.({ root, put, prod, dev });
    const configArgs = (files, compose) => ["compose", ...files.flatMap((file) => ["--env-file", path.join(root, file)]), "-f", path.join(root, compose), "config", "--format", "json"];
    const calls = [];
    if (!options.missingProd) calls.push({
      args: configArgs([".env"], a), stdout: JSON.stringify(prod), status: 0,
      absent: BUSINESS_KEYS,
      ...options.prodCall,
    });
    if (!options.missingDev) calls.push({
      args: configArgs(options.startup && options.localFile !== undefined ? [".env.dev", ".env.local"] : [".env.dev"], b),
      stdout: JSON.stringify(dev), status: 0,
      absent: options.startup === "docker" ? [] : BUSINESS_KEYS,
      ...options.devCall,
    });
    const statePath = path.join(root, "fake-state.json");
    const logPath = path.join(root, "fake-calls.jsonl");
    put("fake-state.json", JSON.stringify({ calls, logPath }));
    put("bin/docker", `#!${process.execPath}\nconst fs = require('node:fs');\nconst state = JSON.parse(fs.readFileSync(${JSON.stringify(statePath)}, 'utf8'));\nconst args = process.argv.slice(2);\nconst call = state.calls.find(c => JSON.stringify(c.args) === JSON.stringify(args));\nfs.appendFileSync(state.logPath, JSON.stringify({ args, known: Boolean(call) }) + '\\n');\nif (!call || (call.absent || []).some(k => Object.hasOwn(process.env, k)) || Object.entries(call.values || {}).some(([k,v]) => process.env[k] !== v)) { process.stderr.write('UNEXPECTED_DOCKER_CALL_OR_ENV'); process.exit(91); }\nprocess.stdout.write(call.stdout || '');\nprocess.stderr.write(call.stderr || '');\nprocess.exit(call.status || 0);\n`);
    fs.chmodSync(path.join(root, "bin/docker"), 0o755);
    // No inherited user credentials, Docker endpoint, NODE_OPTIONS, or fallback PATH.
    const environment = { PATH: path.join(root, "bin"), HOME: root, ENV_CHECK_ROOT: root, ...options.processEnv };
    const args = [script, "--compose-a", a, "--compose-b", b];
    if (options.startup) args.push("--startup", options.startup);
    const run = () => spawnSync(process.execPath, args, { env: environment, encoding: "utf8", timeout: 10_000 });
    const context = { root, prod, dev, calls, statePath, environment, run, logPath };
    if (inspect) return inspect(context);
    const result = run();
    const logs = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
    const output = (result.stdout ?? "") + (result.stderr ?? "");
    for (const secret of [...Object.values(PROD), ...Object.values(DEV), ...Object.values(PERSONAL), PRIVATE_DIAGNOSTIC, "fixture-password"]) {
      assert.ok(!output.includes(secret), "checker output exposed a synthetic credential");
    }
    assert.equal(result.error, undefined, "checker did not finish");
    return { ...result, output, logs };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const passed = (result) => { assert.equal(result.status, 0, result.output); assert.match(result.stdout, /passed/); };
const failed = (result) => { assert.equal(result.status, 1, result.output); assert.match(result.stderr, /failed/i); };

test("standalone renders two independent canonical stacks without inherited dev variables", () => {
  const result = fixture({ processEnv: { ...effective(), COMPOSE_FILE: "poison.yml", COMPOSE_ENV_FILES: "poison.env" } });
  passed(result);
  assert.equal(result.logs.length, 2);
  assert.ok(result.logs.every((call) => call.known));
  assert.match(result.stdout, /已分离/);
});

test("shared canonical database accepts identical keys but never claims isolation", () => {
  const result = fixture({ devKeys: PROD, prepare: ({ prod, dev }) => { dev.services.postgres.volumes = prod.services.postgres.volumes; } });
  passed(result);
  assert.match(result.stdout, /共用/);
  assert.doesNotMatch(result.stdout, /已分离|允许不同/);
});

test("shared database rejects either differing key and single-sided configuration", () => {
  for (const key of Object.keys(PROD)) {
    const result = fixture({ devKeys: { ...PROD, [key]: DEV[key] }, prepare: ({ prod, dev }) => { dev.services.postgres.volumes = prod.services.postgres.volumes; } });
    failed(result);
    assert.match(result.stderr, new RegExp(key));
  }
  const result = fixture({ devKeys: { SECRET_KEY: PROD.SECRET_KEY }, prepare: ({ prod, dev }) => { dev.services.postgres.volumes = prod.services.postgres.volumes; } });
  failed(result);
  assert.match(result.stderr, /AGENT_API_KEY_ENCRYPTION_KEY/);
});

test("startup local permits independent dev keys when the actual target and keys match", () => {
  passed(fixture({ startup: "local", processEnv: effective() }));
});

test("auxiliary-service first-mount bait cannot hide the real shared postgres mount", () => {
  const result = fixture({
    yamlA: `services:\n  auxiliary:\n    volumes:\n      - ./bait/prod:/var/lib/postgresql/data\n` + composeText("./data/postgres"),
    yamlB: `services:\n  auxiliary:\n    volumes:\n      - ./bait/dev:/var/lib/postgresql/data\n` + composeText("./data/postgres"),
    prepare: ({ prod, dev, root }) => {
      dev.services.postgres.volumes = prod.services.postgres.volumes;
      prod.services.auxiliary = { volumes: [bind(path.join(root, "bait/prod"), "/var/lib/postgresql/data")] };
      dev.services.auxiliary = { volumes: [bind(path.join(root, "bait/dev"), "/var/lib/postgresql/data")] };
    },
  });
  failed(result);
  assert.match(result.stderr, /关键密钥必须一致/);
});

test("redis is selected by service and startup rejects shared cache despite auxiliary bait", () => {
  failed(fixture({ startup: "local", processEnv: effective(), prepare: ({ prod, dev, root }) => {
    dev.services.redis.volumes = prod.services.redis.volumes;
    dev.services.auxiliary = { volumes: [bind(path.join(root, "bait/redis"), "/data")] };
  } }));
});

test("canonical bind sources follow symlinks even when the data directory does not exist yet", () => {
  failed(fixture({ prepare: ({ root, put, prod, dev }) => {
    put("physical/.keep", "");
    fs.symlinkSync(path.join(root, "physical"), path.join(root, "alias"), "dir");
    prod.services.postgres.volumes[0].source = path.join(root, "physical/missing/data");
    dev.services.postgres.volumes[0].source = path.join(root, "alias/missing/data");
  } }));
});

test("long syntax and read_only mounts use the canonical model, not line matching", () => {
  passed(fixture({
    yamlA: "services:\n  postgres:\n    volumes:\n      - type: bind\n        source: ./data/postgres\n        target: /var/lib/postgresql/data\n        read_only: true\n",
    yamlB: "services:\n  postgres:\n    volumes:\n      - ./data/dev/postgres:/var/lib/postgresql/data:ro\n",
    prepare: ({ prod, dev }) => { prod.services.postgres.volumes[0].read_only = true; dev.services.postgres.volumes[0].read_only = true; },
  }));
});

test("equal relative text in different Compose parent directories is not a shared source", () => {
  passed(fixture({ composeA: "prod/compose.yml", composeB: "dev/compose.yml", yamlA: composeText("./data/postgres"), yamlB: composeText("./data/postgres"), prepare: ({ root, prod, dev }) => {
    prod.services.postgres.volumes[0].source = path.join(root, "prod/data/postgres");
    dev.services.postgres.volumes[0].source = path.join(root, "dev/data/postgres");
  } }));
});

test("missing services, duplicate targets, named volumes and unresolved sources fail closed even with equal keys", () => {
  const mutations = [
    (dev) => { delete dev.services.backend; },
    (dev) => { dev.services.postgres.volumes = []; },
    (dev) => { dev.services.postgres.volumes.push({ ...dev.services.postgres.volumes[0] }); },
    (dev) => { dev.services.postgres.volumes[0] = { type: "volume", source: "pg-data", target: "/var/lib/postgresql/data" }; },
    (dev) => { dev.services.postgres.volumes[0].source = "./not-canonical"; },
  ];
  for (const mutate of mutations) {
    const result = fixture({ devKeys: PROD, prepare: ({ dev }) => mutate(dev) });
    failed(result);
    assert.match(result.stderr, /无法|未知|unknown/i);
    assert.doesNotMatch(result.stdout, /已分离/);
  }
});

test("invalid JSON and failed config hide all raw stdout and stderr", () => {
  for (const prodCall of [
    { stdout: PRIVATE_DIAGNOSTIC + " {bad json" },
    { stdout: JSON.stringify({ services: {} }), stderr: PRIVATE_DIAGNOSTIC, status: 42 },
  ]) failed(fixture({ prodCall, devKeys: PROD }));
});

test("missing standalone env skips before Docker but startup requires the dev env", () => {
  const skipped = fixture({ missingDev: true });
  assert.equal(skipped.status, 0, skipped.output);
  assert.match(skipped.stdout, /skipped/);
  assert.equal(skipped.logs.length, 0);
  const strict = fixture({ missingDev: true, startup: "local", processEnv: effective() });
  failed(strict);
  assert.equal(strict.logs.length, 0);
});

test("dev-only startup is bounded by physical data/dev and states the unverified prod limit", () => {
  const valid = fixture({ missingProd: true, startup: "local", processEnv: effective() });
  passed(valid);
  assert.match(valid.stdout, /dev-only/);
  assert.match(valid.stdout, /未验证|无法验证/);
  assert.doesNotMatch(valid.stdout, /两栈.*已分离/);
  failed(fixture({ missingProd: true, startup: "local", processEnv: effective(), prepare: ({ root, dev }) => { dev.services.postgres.volumes[0].source = path.join(root, "custom/postgres"); } }));
  failed(fixture({ missingProd: true, startup: "local", processEnv: effective(), prepare: ({ root, put }) => {
    put("outside/.keep", "");
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
    fs.symlinkSync(path.join(root, "outside"), path.join(root, "data/dev"), "dir");
  } }));
});

test("an existing prod env with render failure cannot degrade to dev-only", () => {
  failed(fixture({ startup: "local", processEnv: effective(), prodCall: { status: 1, stderr: PRIVATE_DIAGNOSTIC } }));
});

test("local actual host, port, database and DATABASE_URL must identify the canonical dev postgres", () => {
  const wrong = [
    { POSTGRES_PORT: "5432" }, { POSTGRES_HOST: "remote.example.invalid" }, { POSTGRES_DB: "other_db" },
    { DATABASE_URL: "postgresql://fixture:fixture-password@127.0.0.1:5432/fixture_db" },
    { DATABASE_URL: "postgresql://fixture:fixture-password@127.0.0.1:5433/fixture_db?host=other.example.invalid" },
  ];
  for (const override of wrong) failed(fixture({ startup: "local", processEnv: { ...effective(), ...override } }));
});

test("local effective key mismatch is checked against independent dev rendering, not prod", () => {
  for (const key of Object.keys(DEV)) {
    const result = fixture({ startup: "local", processEnv: { ...effective(), [key]: PERSONAL[key] } });
    failed(result);
    assert.match(result.stderr, new RegExp(key));
  }
});

test("env.local overrides and quoted/export/variable syntax are delegated to mock canonical config, not a Docker-parser claim", () => {
  passed(fixture({ startup: "local", processEnv: effective(PERSONAL, { db: "personal_db" }),
    localFile: `export SECRET_KEY="${PERSONAL.SECRET_KEY}"\nAGENT_API_KEY_ENCRYPTION_KEY='${PERSONAL.AGENT_API_KEY_ENCRYPTION_KEY}'\nDB_SUFFIX=db\nPOSTGRES_DB=personal_${"${DB_SUFFIX}"}\n`,
    prepare: ({ dev }) => { dev.services.backend.environment = { ...dev.services.backend.environment, ...PERSONAL, POSTGRES_DB: "personal_db" }; dev.services.postgres.environment.POSTGRES_DB = "personal_db"; },
  }));
});

test("docker startup passes effective process overrides to dev only, never to prod", () => {
  const processEnv = effective(PERSONAL, { db: "personal_db" });
  const result = fixture({ startup: "docker", processEnv,
    devCall: { values: processEnv, absent: ["COMPOSE_FILE", "COMPOSE_ENV_FILES"] },
    prepare: ({ dev }) => { dev.services.backend.environment = { ...dev.services.backend.environment, ...PERSONAL, POSTGRES_DB: "personal_db" }; dev.services.postgres.environment.POSTGRES_DB = "personal_db"; },
  });
  passed(result);
  assert.equal(result.logs.length, 2);
});

test("canonical backend targets outside the rendered postgres fail closed", () => {
  for (const override of [
    { POSTGRES_HOST: "remote.example.invalid" }, { POSTGRES_DB: "other_db" },
    { DATABASE_URL: "postgresql://fixture:fixture-password@remote.example.invalid:5432/fixture_db" },
  ]) failed(fixture({ startup: "docker", processEnv: effective(), prepare: ({ dev }) => { Object.assign(dev.services.backend.environment, override); } }));
});

test("provably separate nondefault local target and bind overrides are permitted", () => {
  passed(fixture({ startup: "local", processEnv: effective(DEV, { port: "15433", db: "custom_dev" }), prepare: ({ root, dev }) => {
    dev.services.postgres.ports[0].published = "15433";
    dev.services.postgres.environment.POSTGRES_DB = "custom_dev";
    dev.services.backend.environment.POSTGRES_DB = "custom_dev";
    dev.services.postgres.volumes[0].source = path.join(root, "custom/postgres");
  } }));
});

test("startup rejects shared or nested prod data even when keys match", () => {
  for (const nested of [false, true]) failed(fixture({ devKeys: PROD, startup: "local", processEnv: effective(PROD), prepare: ({ prod, dev }) => {
    dev.services.postgres.volumes[0].source = prod.services.postgres.volumes[0].source + (nested ? "/nested" : "");
  } }));
});

test("public helpers sanitize environment, render absolute argv and return fixed errors", async () => {
  const { cleanComposeEnvironment, renderCompose } = await import(helperUrl);
  assert.deepEqual(cleanComposeEnvironment({ PATH: "/fixture/bin", HOME: "/fixture/home", ...effective(), COMPOSE_FILE: "bad", NODE_OPTIONS: "bad" }), { PATH: "/fixture/bin", HOME: "/fixture/home" });
  fixture({}, ({ root, environment, prod, statePath, calls }) => {
    const oldPath = process.env.PATH;
    const oldPwd = process.env.PWD;
    try {
      process.env.PATH = environment.PATH;
      process.env.PWD = "/poisoned-parent-directory";
      calls[0].values = { PWD: fs.realpathSync(root) };
      fs.writeFileSync(statePath, JSON.stringify({ calls, logPath: path.join(root, "fake-calls.jsonl") }));
      assert.deepEqual(renderCompose({ root, envFile: ".env", composeFile: "docker-compose.yml", environment: { PWD: "/poisoned-explicit-directory" } }), prod);
      calls[0].stdout = "bad JSON " + PRIVATE_DIAGNOSTIC;
      fs.writeFileSync(statePath, JSON.stringify({ calls, logPath: path.join(root, "fake-calls.jsonl") }));
      assert.throws(() => renderCompose({ root, envFile: ".env", composeFile: "docker-compose.yml" }), (error) => {
        assert.equal(error.code, "COMPOSE_CONFIG_INVALID");
        assert.ok(!String(error).includes(PRIVATE_DIAGNOSTIC));
        assert.equal(error.cause, undefined);
        return true;
      });
    } finally {
      if (oldPath === undefined) delete process.env.PATH; else process.env.PATH = oldPath;
      if (oldPwd === undefined) delete process.env.PWD; else process.env.PWD = oldPwd;
    }
  });
});

test("local Docker context, unix host and TLS configuration stay identical in both renders", async () => {
  const { cleanComposeEnvironment } = await import(helperUrl);
  const local = {
    DOCKER_CONTEXT: "desktop-linux", DOCKER_HOST: "unix:///fixture/docker.sock",
    DOCKER_TLS: "1", DOCKER_TLS_VERIFY: "1", DOCKER_CERT_PATH: "/fixture/certs", DOCKER_CONFIG: "/fixture/config",
  };
  assert.deepEqual(cleanComposeEnvironment(local), local);
  passed(fixture({ processEnv: local, prodCall: { values: local }, devCall: { values: local } }));
  assert.deepEqual(cleanComposeEnvironment({ DOCKER_CONTEXT: "default" }), { DOCKER_CONTEXT: "default" });
  for (const unsafe of [
    { DOCKER_CONTEXT: "remote-fixture" }, { DOCKER_HOST: "ssh://fixture@remote.invalid" },
    { DOCKER_HOST: "tcp://remote.invalid:2375" }, { DOCKER_HOST: "unix://relative.sock" },
  ]) {
    assert.throws(() => cleanComposeEnvironment(unsafe), { code: "COMPOSE_CONFIG_FAILED" });
    const result = fixture({ processEnv: unsafe });
    failed(result);
    assert.equal(result.logs.length, 0, "unsafe Docker endpoint must be rejected before spawning");
    for (const value of Object.values(unsafe)) assert.ok(!result.output.includes(value));
  }
});

test("physicalPath resolves the nearest existing ancestor and rejects dangling links", async () => {
  const { physicalPath } = await import(helperUrl);
  fixture({}, ({ root }) => {
    fs.mkdirSync(path.join(root, "existing"));
    fs.symlinkSync(path.join(root, "existing"), path.join(root, "link"), "dir");
    assert.equal(physicalPath(path.join(root, "link/missing/data")), path.join(fs.realpathSync(root), "existing/missing/data"));
    fs.symlinkSync(path.join(root, "absent"), path.join(root, "dangling"), "dir");
    assert.throws(() => physicalPath(path.join(root, "dangling/data")), { code: "COMPOSE_PATH_UNKNOWN" });
  });
});
