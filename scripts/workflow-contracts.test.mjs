import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const repoRoot = new URL("..", import.meta.url);

const requiredReleaseImages = [
  "wangsh-backend",
  "wangsh-typst-worker",
  "wangsh-pythonlab-worker",
  "pythonlab-sandbox",
  "wangsh-frontend",
  "wangsh-gateway",
];
const defaultDigest = "sha256:" + "0".repeat(64);
const healthyHealthResponse =
  '{"status":"healthy","checks":{"database":"healthy","redis":"healthy"},"system":{"version":"1.6.0","debug_mode":false}}';
const detailedHealthContainerServices = [
  "postgres",
  "redis",
  "frontend",
  "gateway",
  "typst-worker",
  "pythonlab-worker",
];

function writeExecutable(path, contents) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function runDeployWithFakeDocker({
  releaseSet,
  composeImages = null,
  dockerDigestOverrides = {},
  localDigestOverrides = {},
  envOverrides = {},
  command = "verify-release-set",
}) {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-release-set-contract-"));
  const envFile = join(directory, ".env");
  const composeFile = join(directory, "compose.yml");
  const releaseSetFile = join(directory, "release-set.txt");
  const dockerFile = join(directory, "docker");
  const dockerLogFile = join(directory, "docker.log");
  const expectedImages =
    composeImages ??
    [
      "shuhao07/wangsh-backend:1.6.0",
      "shuhao07/wangsh-typst-worker:1.6.0",
      "shuhao07/wangsh-pythonlab-worker:1.6.0",
      "shuhao07/pythonlab-sandbox:1.6.0",
      "shuhao07/wangsh-frontend:1.6.0",
      "shuhao07/wangsh-gateway:1.6.0",
    ];
  const envValues = {
    APP_VERSION: "1.6.0",
    IMAGE_TAG: "1.6.0",
    IMAGE_REPOSITORY_PREFIX: "shuhao07",
    IMAGE_NAME_BACKEND: "wangsh-backend",
    IMAGE_NAME_WORKER: "wangsh-typst-worker",
    IMAGE_NAME_PYTHONLAB_WORKER: "wangsh-pythonlab-worker",
    IMAGE_NAME_GATEWAY: "wangsh-gateway",
    PYTHONLAB_SANDBOX_IMAGE: "shuhao07/pythonlab-sandbox:1.6.0",
    ...envOverrides,
  };

  writeFileSync(
    envFile,
    `${Object.entries(envValues)
      .filter(([, value]) => value != null)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
  writeFileSync(composeFile, "services: {}\n");
  writeFileSync(releaseSetFile, releaseSet);
  writeFileSync(
    dockerFile,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "info" ]]; then
  exit 0
fi
if [[ "$*" == *" config --environment" ]]; then
  cat <<'EOF'
${Object.entries(envValues)
  .filter(([, value]) => value != null)
  .map(([key, value]) => `${key}=${value}`)
  .join("\n")}
EOF
  exit 0
fi
if [[ "$*" == *" config --images" ]]; then
${expectedImages.map((image) => `  printf '%s\\n' '${image}'`).join("\n")}
  exit 0
fi
if [[ "$*" == *"buildx imagetools inspect"* ]]; then
  ref="\${!#}"
  case "$ref" in
${requiredReleaseImages
  .map((image) => {
    const ref = `shuhao07/${image}:1.6.0`;
    const digest = dockerDigestOverrides[image] ?? defaultDigest;
    return `    ${ref}) printf 'Name: %s\\nDigest: %s\\n' "$ref" '${digest}' ;;`;
  })
  .join("\n")}
    *) echo "unexpected image ref: $ref" >&2; exit 1 ;;
  esac
  exit 0
fi
if [[ "$*" == image\\ inspect* ]]; then
  ref="\${!#}"
  case "$ref" in
${requiredReleaseImages
  .map((image) => {
    const ref = `shuhao07/${image}:1.6.0`;
    const digest = localDigestOverrides[image] ?? defaultDigest;
    return `    ${ref}) printf '%s\\n' 'shuhao07/${image}@${digest}' ;;`;
  })
  .join("\n")}
    *) echo "unexpected local image ref: $ref" >&2; exit 1 ;;
  esac
  exit 0
fi
if [[ "$*" == *" pull "* || "$*" == *" up -d --no-build"* || "$*" == *" ps" ]]; then
  printf '%s\\n' "$*" >> '${dockerLogFile}'
  exit 0
fi
echo "unexpected fake docker invocation: $*" >&2
exit 1
`,
  );
  chmodSync(dockerFile, 0o755);

  const result = spawnSync(
    "bash",
    ["scripts/deploy.sh", command, releaseSetFile],
    {
      cwd: new URL(repoRoot).pathname,
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        ENV_FILE: envFile,
        COMPOSE_FILE: composeFile,
      },
      encoding: "utf8",
    },
  );
  return {
    ...result,
    directory,
    dockerLog: readFileSync(dockerLogFile, { encoding: "utf8", flag: "a+" }),
  };
}

function makeReleaseSet({
  version = "1.6.0",
  rows = requiredReleaseImages,
  digest = null,
  refOverrides = {},
} = {}) {
  const lines = ["format=wangsh-release-set-v1", `version=${version}`];
  for (const image of rows) {
    const ref = refOverrides[image] ?? `shuhao07/${image}:${version}`;
    const imageDigest = digest ?? defaultDigest;
    lines.push(`image=${image} ref=${ref} digest=${imageDigest}`);
  }
  return `${lines.join("\n")}\n`;
}

function runDetailedHealthCheck({
  composeExecStatus = 0,
  containerWithoutHealth = "",
  curlStatus = 0,
  httpStatus = 200,
  response,
}) {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-detailed-health-contract-"));
  const composeFile = join(directory, "compose.yml");
  const containerPythonFile = join(directory, "container-python");
  const composeExecInputFile = join(directory, "compose-exec-input.json");
  const composeExecLogFile = join(directory, "compose-exec.log");
  const python3LogFile = join(directory, "python3.log");

  writeFileSync(composeFile, "services: {}\n");
  writeExecutable(
    containerPythonFile,
    `#!${process.execPath}
const fs = require("node:fs");

const input = fs.readFileSync(0);
const code = process.argv[3] ?? "";
fs.writeFileSync(process.env.MOCK_COMPOSE_EXEC_INPUT, input);
if (
  process.argv[2] !== "-c" ||
  !code.includes("object_pairs_hook=JSONObject") ||
  !code.includes("status_count == 1") ||
  !code.includes('payload.get("status") == "healthy"')
) {
  process.exit(98);
}
process.exit(Number(process.env.MOCK_COMPOSE_EXEC_STATUS ?? "1"));
`,
  );
  writeExecutable(
    join(directory, "curl"),
    `#!/usr/bin/env bash
printf '%s\\n%s' "\${MOCK_HEALTH_RESPONSE:-}" "\${MOCK_HEALTH_STATUS:-000}"
exit "\${MOCK_CURL_STATUS:-0}"
`,
  );
  writeExecutable(
    join(directory, "docker"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "compose" && "$*" == *" exec -T backend python -c "* ]]; then
  printf 'exec\\n' >> "\${MOCK_COMPOSE_EXEC_LOG}"
  "\${MOCK_CONTAINER_PYTHON}" -c "\${!#}"
  exit $?
fi
if [[ "$1" == "compose" && "$*" == *" ps -q "* ]]; then
  printf '%s-id\\n' "\${!#}"
  exit 0
fi
if [[ "$1" == "inspect" && "$*" == *".State.Status"* ]]; then
  printf 'running\\n'
  exit 0
fi
if [[ "$1" == "inspect" && "$*" == *".State.Health"* ]]; then
  container_id="\${!#}"
  if [[ "$container_id" == "\${MOCK_CONTAINER_WITHOUT_HEALTH:-missing}-id" ]]; then
    printf 'none\\n'
  else
    printf 'healthy\\n'
  fi
  exit 0
fi
echo "unexpected fake docker invocation: $*" >&2
exit 1
`,
  );
  writeExecutable(
    join(directory, "python3"),
    `#!/usr/bin/env bash
printf 'unexpected host python3 invocation\\n' >> "\${MOCK_PYTHON3_LOG}"
exit 97
`,
  );
  writeExecutable(
    join(directory, "df"),
    `#!/usr/bin/env bash
printf 'Filesystem Size Used Avail Capacity Mounted on\\n'
printf '/dev/mock 100G 10G 90G 10%% /\\n'
`,
  );
  writeExecutable(
    join(directory, "vm_stat"),
    `#!/usr/bin/env bash
printf 'Pages active: 50.\\n'
printf 'Pages free: 50.\\n'
`,
  );
  writeExecutable(
    join(directory, "free"),
    `#!/usr/bin/env bash
printf 'Mem: 100 50 50\\n'
`,
  );

  const result = spawnSync("/bin/bash", ["scripts/health-check-detailed.sh", "json"], {
    cwd: new URL(repoRoot).pathname,
    env: {
      ...process.env,
      PATH: `${directory}:/usr/bin:/bin`,
      API_URL: "http://mock-health",
      COMPOSE_FILE: composeFile,
      MOCK_COMPOSE_EXEC_STATUS: String(composeExecStatus),
      MOCK_CURL_STATUS: String(curlStatus),
      MOCK_CONTAINER_PYTHON: containerPythonFile,
      MOCK_CONTAINER_WITHOUT_HEALTH: containerWithoutHealth,
      MOCK_COMPOSE_EXEC_INPUT: composeExecInputFile,
      MOCK_COMPOSE_EXEC_LOG: composeExecLogFile,
      MOCK_HEALTH_RESPONSE: response,
      MOCK_HEALTH_STATUS: String(httpStatus),
      MOCK_PYTHON3_LOG: python3LogFile,
    },
    encoding: "utf8",
  });
  return {
    ...result,
    composeExecInput: readFileSync(composeExecInputFile, {
      encoding: "utf8",
      flag: "a+",
    }),
    composeExecLog: readFileSync(composeExecLogFile, {
      encoding: "utf8",
      flag: "a+",
    }),
    python3Log: readFileSync(python3LogFile, {
      encoding: "utf8",
      flag: "a+",
    }),
  };
}

function composeServiceBody(composePath, service) {
  const compose = read(composePath);
  const services =
    compose.match(/^services:\n([\s\S]*?)(?=^networks:\n|^volumes:\n)/m)?.[1] ?? "";
  const serviceSource = `${services}\n  __contract_end__:\n`;
  const escapedService = service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    serviceSource.match(
      new RegExp(
        `^  ${escapedService}:\\n([\\s\\S]*?)(?=^  [a-zA-Z0-9_-]+:\\n|^networks:\\n|^volumes:\\n)`,
        "m",
      ),
    )?.[1] ?? ""
  );
}

function backendHealthcheckCommand(composePath) {
  const backendBody = composeServiceBody(composePath, "backend");
  const testArray = backendBody.match(/^\s+test:\s*(\[.*\])\s*$/m)?.[1];

  assert.ok(testArray, `missing backend healthcheck in ${composePath}`);
  const [kind, command] = JSON.parse(testArray);
  assert.equal(kind, "CMD-SHELL");
  return command;
}

function runComposeBackendHealthcheck(
  composePath,
  { connectionError = false, httpStatus = 200, response },
) {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-compose-health-contract-"));
  const siteCustomize = join(directory, "sitecustomize.py");
  const closeLogFile = join(directory, "close.log");

  writeFileSync(
    siteCustomize,
    `import http.client
import os

class MockResponse:
    status = int(os.environ.get("MOCK_HEALTH_STATUS", "200"))

    def read(self):
        return os.environ.get("MOCK_HEALTH_RESPONSE", "").encode()

class MockConnection:
    def __init__(self, *args, **kwargs):
        pass

    def request(self, *args, **kwargs):
        if os.environ.get("MOCK_CONNECTION_ERROR") == "true":
            raise OSError("mock connection failure")

    def getresponse(self):
        return MockResponse()

    def close(self):
        with open(os.environ["MOCK_CLOSE_LOG"], "a", encoding="utf-8") as log:
            log.write("closed\\n")

http.client.HTTPConnection = MockConnection
`,
  );
  writeExecutable(
    join(directory, "python"),
    `#!/usr/bin/env bash
exec python3 "$@"
`,
  );
  writeExecutable(
    join(directory, "seq"),
    `#!/usr/bin/env bash
printf '1\\n'
`,
  );
  writeExecutable(
    join(directory, "sleep"),
    `#!/usr/bin/env bash
exit 0
`,
  );

  const result = spawnSync("bash", ["-c", backendHealthcheckCommand(composePath)], {
    cwd: new URL(repoRoot).pathname,
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      PYTHONPATH: directory,
      MOCK_CONNECTION_ERROR: String(connectionError),
      MOCK_HEALTH_RESPONSE: response,
      MOCK_HEALTH_STATUS: String(httpStatus),
      MOCK_CLOSE_LOG: closeLogFile,
    },
    encoding: "utf8",
  });
  return {
    ...result,
    closeLog: readFileSync(closeLogFile, {
      encoding: "utf8",
      flag: "a+",
    }),
  };
}

function runRollback({
  backupStatus = 0,
  noBackup = false,
  restartStatus = 0,
  rollbackOptions = [],
  runningWriteServices = ["backend", "typst-worker", "pythonlab-worker"],
  stopStatus = 0,
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-rollback-contract-"));
  const scriptsDirectory = join(directory, "scripts");
  const outsideDirectory = join(directory, "outside");
  const dockerFile = join(directory, "docker");
  const operationLogFile = join(directory, "operations.log");
  const envFile = join(directory, ".env");
  const composeFile = join(directory, "compose.yml");

  mkdirSync(scriptsDirectory);
  mkdirSync(outsideDirectory);
  writeFileSync(envFile, "\n");
  writeFileSync(composeFile, "services: {}\n");
  writeFileSync(join(scriptsDirectory, "rollback.sh"), read("scripts/rollback.sh"));
  writeExecutable(
    join(scriptsDirectory, "deploy.sh"),
    `#!/usr/bin/env bash
set -euo pipefail
test "$1" = "backup-db"
test "$ENV_FILE" = "$EXPECTED_ENV_FILE"
test "$COMPOSE_FILE" = "$EXPECTED_COMPOSE_FILE"
printf 'backup\\n' >> '${operationLogFile}'
exit ${backupStatus}
`,
  );
  chmodSync(join(scriptsDirectory, "rollback.sh"), 0o755);
  writeExecutable(
    dockerFile,
    `#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "$*" >> '${operationLogFile}'
if [[ "$*" == *" ps postgres" ]]; then
  echo "postgres Up"
  exit 0
fi
if [[ "$*" == *" ps --status running --services backend typst-worker pythonlab-worker" ]]; then
  cat <<'EOF'
${runningWriteServices.join("\n")}
EOF
  exit 0
fi
if [[ "$*" == *" stop backend typst-worker pythonlab-worker" ]]; then
  exit ${stopStatus}
fi
if [[ "$*" == *" start "* ]]; then
  exit ${restartStatus}
fi
if [[ "$*" == *" run --rm --no-deps backend alembic downgrade target_revision" ]]; then
  exit 0
fi
echo "unexpected fake docker invocation: $*" >&2
exit 1
`,
  );

  const args = [
    join(scriptsDirectory, "rollback.sh"),
    "rollback",
    "target_revision",
  ];
  if (noBackup) {
    args.push("--no-backup");
  }
  args.push(...rollbackOptions);
  const result = spawnSync("bash", args, {
    cwd: outsideDirectory,
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      ENV_FILE: envFile,
      COMPOSE_FILE: composeFile,
      EXPECTED_ENV_FILE: envFile,
      EXPECTED_COMPOSE_FILE: composeFile,
    },
    input: "yes\n",
    encoding: "utf8",
  });

  return {
    ...result,
    operations: readFileSync(operationLogFile, {
      encoding: "utf8",
      flag: "a+",
    }),
  };
}

test("docker publish validates source version and does not default to latest", () => {
  const workflow = read(".github/workflows/dockerhub-amd64.yml");

  assert.match(workflow, /push_latest:[\s\S]*?default:\s*"false"/);
  assert.match(workflow, /RELEASE_TAG:\s*\$\{\{\s*inputs\.image_tag\s*\}\}/);
  assert.match(workflow, /validate image tag against source version/);
  assert.match(workflow, /frontend\/package\.json/);
  const runBlocks = [...workflow.matchAll(/^\s+run:\s*\|\n((?:^\s{10,}.*\n?)*)/gm)]
    .map((match) => match[1]);
  for (const runBlock of runBlocks) {
    assert.doesNotMatch(runBlock, /\$\{\{\s*inputs\.image_tag\s*\}\}/);
  }
  assert.match(workflow, /promote version tags after all builds/);
  assert.match(workflow, /verify promoted release set/);
  assert.match(workflow, /STAGING_TAG/);
  assert.match(workflow, /format=wangsh-release-set-v1/);
  assert.match(workflow, /image=.*ref=.*digest=/);
  assert.match(workflow, /release_ref="shuhao07\/\$\{image\}:\$\{RELEASE_TAG\}"/);
  assert.doesNotMatch(workflow, /release_ref="docker\.io\/shuhao07\//);
  assert.doesNotMatch(workflow, /imagetools inspect --raw[\s\S]*sha256sum/);
  assert.match(workflow, /Digest:/);
});

test("docker publish is serialized and only promotes the current main commit", () => {
  const workflow = read(".github/workflows/dockerhub-amd64.yml");

  assert.match(
    workflow,
    /concurrency:\s*\n\s*group:\s*dockerhub-amd64-release\s*\n\s*cancel-in-progress:\s*false/,
  );
  assert.match(workflow, /source-guard:/);
  assert.match(workflow, /\[\[ "\$GITHUB_REF" == "refs\/heads\/main" \]\]/);
  assert.match(workflow, /git fetch --no-tags origin main/);
  assert.match(
    workflow,
    /\[\[ "\$\(git rev-parse HEAD\)" == "\$\(git rev-parse origin\/main\)" \]\]/,
  );
  assert.match(workflow, /quality-gate:[\s\S]*needs:\s*source-guard/);
});

test("formal deploy and pull-up consume release-set before compose pull/up", () => {
  const deploy = read("scripts/deploy.sh");
  const upNoBuildBody =
    deploy.match(/up-no-build\)([\s\S]*?)\n\s*;;/)?.[1] ?? "";

  assert.match(deploy, /verify-release-set/);
  assert.match(deploy, /pull-up\)[\s\S]*verify_release_set[\s\S]*compose pull "\$\{release_services\[@\]\}"[\s\S]*compose up -d --no-build --pull never/);
  assert.match(deploy, /deploy\)[\s\S]*bash "\$\{repo_root\}\/scripts\/deploy\.sh" pull-up[\s\S]*wait_for_detailed_health/);
  assert.match(upNoBuildBody, /verify_release_set/);
  assert.match(upNoBuildBody, /compose up -d --no-build --pull never/);
});

test("local production simulation uses local images and can smoke with guaranteed cleanup", () => {
  const deploy = read("scripts/deploy.sh");
  const simulateBody =
    deploy.match(/\n\s*simulate\)([\s\S]*?)\n\s*;;/)?.[1] ?? "";

  assert.doesNotMatch(simulateBody, /up-no-build|verify_release_set/);
  assert.match(simulateBody, /verify-local-images/);
  assert.match(simulateBody, /docker compose[\s\S]*up -d --no-build/);
  assert.ok(
    simulateBody.indexOf("verify-local-images") < simulateBody.lastIndexOf("down-v"),
    "simulation must verify local images before deleting prior simulation volumes",
  );
  assert.match(simulateBody, /SIM_RUN_PROD_SMOKE/);
  assert.match(simulateBody, /PROD_SMOKE_ORIGIN=.*sim_web_port/);
  assert.match(simulateBody, /PROD_SMOKE_COMPOSE_PROJECT_NAME=.*sim_project/);
  assert.match(simulateBody, /PROD_SMOKE_COMPOSE_ENV_FILE=.*tmp_env/);
  assert.match(simulateBody, /PROD_SMOKE_COMPOSE_FILE=.*compose_file/);
  assert.match(simulateBody, /SUPER_ADMIN_PASSWORD=.*admin_password/);
  assert.match(simulateBody, /SIM_CLEANUP/);
  assert.match(deploy, /require_volume_deletion_confirmation/);
  assert.match(deploy, /COMPOSE_PROJECT_NAME:-\}" = "wangsh_sim"/);
  assert.match(deploy, /ALLOW_VOLUME_DELETION/);
  assert.match(simulateBody, /docker ps -aq --filter "name=\^\/\$\{sim_namespace\}_"/);
  assert.match(simulateBody, /docker rm -f/);
  assert.match(simulateBody, /sim_lock_dir/);
  assert.match(simulateBody, /mkdir "\$\{sim_lock_dir\}"/);
  assert.match(simulateBody, /another production simulation is already running/);
  assert.match(simulateBody, /rm -rf -- "\$\{sim_lock_dir\}"/);
});

test("production compose isolates Redis and PythonLab runtime resources", () => {
  const compose = read("docker-compose.yml");
  const devCompose = read("docker-compose.dev.yml");
  const redisBody = compose.match(/^  redis:\n([\s\S]*?)^  backend:/m)?.[1] ?? "";

  assert.doesNotMatch(redisBody, /container_name:/);
  assert.match(compose, /^\s{2}REDIS_HOST: redis$/m);
  assert.doesNotMatch(compose, /wangsh-redis/);
  assert.match(devCompose, /container_name:\s*wangsh-redis/);
  assert.match(
    compose,
    /^\s{2}PYTHONLAB_CONTAINER_NAMESPACE: \$\{PYTHONLAB_CONTAINER_NAMESPACE:-pythonlab\}$/m,
  );
  assert.equal(
    (
      compose.match(
        /\$\{PYTHONLAB_HOST_WORKSPACE_ROOT:-\.\/data\/pythonlab\/workspaces\}:\$\{PYTHONLAB_WORKSPACE_ROOT:-\/tmp\/pythonlab\/workspaces\}/g,
      ) ?? []
    ).length,
    2,
  );
});

test("Compose passes the configured application timezone to backend services", () => {
  const compose = read("docker-compose.yml");
  const devCompose = read("docker-compose.dev.yml");
  const applicationServices = ["backend", "typst-worker", "pythonlab-worker"];
  const timezoneDefault = "\\$\\{TIMEZONE:-Asia/Shanghai\\}";

  assert.match(
    compose,
    new RegExp(`^  TIMEZONE: ${timezoneDefault}$`, "m"),
  );
  assert.match(compose, new RegExp(`^  TZ: ${timezoneDefault}$`, "m"));
  assert.match(
    compose,
    /^x-common-with-pythonlab-env: &common-with-pythonlab-env\n  <<: \*common-env$/m,
  );

  for (const service of applicationServices) {
    const productionBody = composeServiceBody("docker-compose.yml", service);
    const developmentBody = composeServiceBody("docker-compose.dev.yml", service);

    assert.match(
      productionBody,
      /^\s+<<: \*common(?:-with-pythonlab)?-env$/m,
      `production ${service} must inherit the application timezone`,
    );
    assert.match(
      developmentBody,
      new RegExp(`^\\s+- TIMEZONE=${timezoneDefault}$`, "m"),
      `development ${service} is missing TIMEZONE`,
    );
    assert.match(
      developmentBody,
      new RegExp(`^\\s+- TZ=${timezoneDefault}$`, "m"),
      `development ${service} is missing container TZ`,
    );
  }

  const productionPostgres = composeServiceBody("docker-compose.yml", "postgres");
  const developmentPostgres = composeServiceBody(
    "docker-compose.dev.yml",
    "postgres",
  );

  assert.match(
    productionPostgres,
    new RegExp(`^\\s+TZ: ${timezoneDefault}$`, "m"),
  );
  assert.match(
    developmentPostgres,
    new RegExp(`^\\s+TZ: ${timezoneDefault}$`, "m"),
  );
  assert.match(
    developmentPostgres,
    new RegExp(`^\\s+PGTZ: ${timezoneDefault}$`, "m"),
  );
  assert.match(
    developmentPostgres,
    new RegExp(
      `^\\s+command: \\[ "postgres", "-c", "timezone=${timezoneDefault}" \\]$`,
      "m",
    ),
  );
});

test("production simulation overrides parent variables and owns isolated workspaces", () => {
  const deploy = read("scripts/deploy.sh");
  const simulateBody =
    deploy.match(/\n\s*simulate\)([\s\S]*?)\n\s*;;/)?.[1] ?? "";

  assert.match(simulateBody, /sim_project="wangsh_sim"/);
  assert.doesNotMatch(simulateBody, /sim_project="\$\{COMPOSE_PROJECT_NAME/);
  assert.match(simulateBody, /data\/pythonlab\/simulations/);
  assert.match(simulateBody, /mktemp -d/);
  assert.match(simulateBody, /PYTHONLAB_WORKSPACE_ROOT=\/tmp\/pythonlab\/workspaces/);
  assert.match(simulateBody, /HOST_WORKSPACE_ROOT=\$\{sim_workspace_dir\}/);
  assert.match(simulateBody, /PYTHONLAB_HOST_WORKSPACE_ROOT=\$\{sim_workspace_dir\}/);
  assert.match(simulateBody, /sim_namespace="wangsh_sim"/);
  assert.match(simulateBody, /PYTHONLAB_CONTAINER_NAMESPACE="\$\{sim_namespace\}"/);
  for (const key of [
    "COMPOSE_PROJECT_NAME",
    "APP_VERSION",
    "IMAGE_TAG",
    "REACT_APP_VERSION",
    "IMAGE_REPOSITORY_PREFIX",
    "PYTHONLAB_SANDBOX_IMAGE",
    "WEB_PORT",
    "PYTHONLAB_CONTAINER_NAMESPACE",
  ]) {
    assert.match(simulateBody, new RegExp(`${key}=`), `simulation must override ${key}`);
  }
  const simulationEnvHelpers = simulateBody.slice(
    simulateBody.indexOf("run_sim_deploy()"),
    simulateBody.indexOf("cleanup_simulation()"),
  );
  for (const [key, source] of [
    ["SECRET_KEY", "secret_key"],
    ["AGENT_API_KEY_ENCRYPTION_KEY", "fernet"],
    ["POSTGRES_PASSWORD", "pg_password"],
    ["SUPER_ADMIN_PASSWORD", "admin_password"],
  ]) {
    assert.equal(
      (
        simulationEnvHelpers.match(
          new RegExp(`${key}="\\$\\{${source}\\}"`, "g"),
        ) ?? []
      ).length,
      2,
      `both simulation compose entrypoints must override ${key}`,
    );
  }
  assert.match(simulateBody, /cleanup_rc/);
  assert.doesNotMatch(simulateBody, /down-v \|\| true/);
  assert.match(simulateBody, /exit "\$\{cleanup_rc\}"/);
  assert.doesNotMatch(simulateBody, /rm -rf[^\n]*data\/pythonlab\/workspaces/);
});

test("prod-smoke only trusts the exact simulation project on a loopback origin", () => {
  const script = [
    "import importlib.util",
    "import pathlib",
    "import sys",
    "path = pathlib.Path('scripts/prod-smoke/run.py').resolve()",
    "spec = importlib.util.spec_from_file_location('wangsh_prod_smoke_run', path)",
    "module = importlib.util.module_from_spec(spec)",
    "sys.modules[spec.name] = module",
    "spec.loader.exec_module(module)",
    "check = module.is_isolated_smoke_target",
    "assert check('wangsh_sim', 'http://127.0.0.1:16608')",
    "assert check('wangsh_sim', 'http://localhost:16608')",
    "assert not check('wangsh_sim-production', 'http://127.0.0.1:16608')",
    "assert not check('wangsh_sim', 'https://production.example')",
  ].join("; ");
  const result = spawnSync("python3", ["-c", script], {
    cwd: new URL(repoRoot).pathname,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("prod smoke passes PythonLab credentials by contract and redacts recorded commands", () => {
  const runner = read("scripts/prod-smoke/run.py");

  assert.equal((runner.match(/"PYTHONLAB_SMOKE_USERNAME": admin_username/g) ?? []).length, 3);
  assert.equal((runner.match(/"PYTHONLAB_SMOKE_PASSWORD": admin_password/g) ?? []).length, 3);
  assert.doesNotMatch(runner, /"--password",\s*\n\s*admin_password/);
  assert.match(runner, /def redact_command\(/);
  assert.match(runner, /command=redact_command\(command/);
  assert.match(runner, /"ADMIN_PASSWORD": admin_password/);
  assert.doesNotMatch(runner, /f"\{code\} \{refreshed\}"/);
  assert.match(runner, /access_token=\{'yes' if refreshed_access_token else 'no'\}/);
  assert.match(runner, /refresh_token=\{'yes' if refreshed_refresh_token else 'no'\}/);
  assert.match(runner, /sensitive_values\s*=\s*collect_sensitive_values\(config/);
  assert.match(
    runner,
    /run_command_step\([\s\S]*?sensitive_values=sensitive_values/,
  );
  assert.match(
    runner,
    /collect_service_logs\([\s\S]*?sensitive_values=sensitive_values/,
  );
  assert.match(runner, /PROD_SMOKE_ALLOW_LIVE/);
  assert.match(runner, /isolated_project/);
});

test("PythonLab PR browser smoke passes credentials through environment only", () => {
  const workflow = read(".github/workflows/pythonlab-pr-runtime.yml");

  assert.match(workflow, /ADMIN_PASSWORD:\s*\$\{\{\s*env\.PYTHONLAB_SMOKE_PASSWORD\s*\}\}/);
  assert.doesNotMatch(workflow, /--password\s+["']?\$PYTHONLAB_SMOKE_PASSWORD/);
});

test("PythonLab remote workflows pass canonical smoke credential variables", () => {
  const workflows = [
    read(".github/workflows/pythonlab-owner-concurrency.yml"),
    read(".github/workflows/pythonlab-phasec-gate.yml"),
  ];

  for (const workflow of workflows) {
    assert.match(
      workflow,
      /PYTHONLAB_SMOKE_USERNAME:\s*\$\{\{\s*secrets\.PYTHONLAB_SMOKE_USERNAME\s*\}\}/,
    );
    assert.match(
      workflow,
      /PYTHONLAB_SMOKE_PASSWORD:\s*\$\{\{\s*secrets\.PYTHONLAB_SMOKE_PASSWORD\s*\}\}/,
    );
    assert.doesNotMatch(
      workflow,
      /^\s+(?:USERNAME|PASSWORD):\s*\$\{\{\s*secrets\.PYTHONLAB_SMOKE_/m,
    );
  }
});

test("PythonLab workflows stream smoke output through the redacting executor", () => {
  const prRuntime = read(".github/workflows/pythonlab-pr-runtime.yml");
  const ownerRuntime = read(".github/workflows/pythonlab-owner-concurrency.yml");
  const phasecRuntime = read(".github/workflows/pythonlab-phasec-gate.yml");

  assert.match(
    prRuntime,
    /python \.\.\/scripts\/prod-smoke\/redact_exec\.py --\s*\\\s*\n\s*node scripts\/pythonlab-debug-smoke\.mjs/,
  );
  for (const script of [
    "smoke_pythonlab_ws_owner_concurrency.py",
    "smoke_pythonlab_print_visibility_probe.py",
    "soak_pythonlab_phasec.py",
  ]) {
    assert.match(
      prRuntime,
      new RegExp(
        `python scripts/prod-smoke/redact_exec\\.py --\\s*\\\\\\s*\\n\\s*python backend/scripts/${script.replaceAll(".", "\\.")}`,
      ),
    );
  }
  assert.match(
    ownerRuntime,
    /python scripts\/prod-smoke\/redact_exec\.py --\s*\\\s*\n\s*python backend\/scripts\/smoke_pythonlab_ws_owner_concurrency\.py/,
  );
  for (const script of [
    "smoke_pythonlab_print_visibility_probe.py",
    "soak_pythonlab_phasec.py",
  ]) {
    assert.match(
      phasecRuntime,
      new RegExp(
        `python scripts/prod-smoke/redact_exec\\.py --\\s*\\\\\\s*\\n\\s*python backend/scripts/${script.replaceAll(".", "\\.")}`,
      ),
    );
  }
});

test("PythonLab PR failure logs are redacted before publishing", () => {
  const workflow = read(".github/workflows/pythonlab-pr-runtime.yml");

  assert.match(workflow, /python scripts\/prod-smoke\/redact\.py --tail 200/);
  assert.doesNotMatch(
    workflow,
    /tail -n 200 "\$log_file" >> "\$GITHUB_STEP_SUMMARY"/,
  );
  assert.doesNotMatch(
    workflow,
    /tail -n 200 \/tmp\/pythonlab-frontend\.log >> "\$GITHUB_STEP_SUMMARY"/,
  );
});

test("prod-smoke redactor tails logs and removes token-shaped secrets", () => {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-log-redactor-"));
  const logFile = join(directory, "runtime.log");
  writeFileSync(
    logFile,
    [
      "old line that should not be included",
      "GET /stream?access_token=query-secret&mode=live",
      'Authorization: Bearer bearer.secret-token {"refresh_token":"json-secret"}',
      "",
    ].join("\n"),
  );

  const result = spawnSync(
    "python3",
    ["scripts/prod-smoke/redact.py", "--tail", "2", logFile],
    {
      cwd: new URL(repoRoot).pathname,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /old line/);
  assert.doesNotMatch(result.stdout, /query-secret|bearer\.secret-token|json-secret/);
  assert.match(result.stdout, /access_token=<redacted>/);
  assert.match(result.stdout, /Bearer <redacted>/);
  assert.match(result.stdout, /"refresh_token":"<redacted>"/);
});

test("prod-smoke redactor removes credential formats and known environment values", () => {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-log-redactor-formats-"));
  const logFile = join(directory, "runtime.log");
  const secrets = [
    "query-password",
    "query-api-key",
    "json-password",
    "json-api-key",
    "dict-token",
    "dict-password",
    "dict-api-key",
    "cookie-token",
    "session-secret",
    "set-cookie-token",
    "basic-credential",
    "known-sensitive-secret",
  ];
  writeFileSync(
    logFile,
    [
      "GET /login?password=query-password&api_key=query-api-key",
      '{"password":"json-password","api_key":"json-api-key"}',
      "{'access_token': 'dict-token', 'password': 'dict-password', 'api_key': 'dict-api-key'}",
      "Cookie: access_token=cookie-token; session=session-secret",
      "Set-Cookie: refresh_token=set-cookie-token; HttpOnly",
      "Authorization: Basic basic-credential",
      "known=known-sensitive-secret",
      "",
    ].join("\n"),
  );

  const result = spawnSync(
    "python3",
    ["scripts/prod-smoke/redact.py", logFile],
    {
      cwd: new URL(repoRoot).pathname,
      env: {
        ...process.env,
        REDACTION_TEST_API_KEY: "known-sensitive-secret",
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  for (const secret of secrets) {
    assert.ok(!result.stdout.includes(secret), `redactor leaked ${secret}`);
  }
  assert.match(result.stdout, /Cookie: <redacted>/);
  assert.match(result.stdout, /Set-Cookie: <redacted>/);
  assert.match(result.stdout, /Basic <redacted>/);
  assert.match(result.stdout, /"password":"<redacted>"/);
  assert.match(result.stdout, /'api_key': '<redacted>'/);
});

test("prod-smoke redactor accepts stdin for child-generated logs", () => {
  const result = spawnSync(
    "python3",
    ["scripts/prod-smoke/redact.py", "-"],
    {
      cwd: new URL(repoRoot).pathname,
      input: "GET /ws?token=stdin-secret\n",
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /stdin-secret/);
  assert.match(result.stdout, /token=<redacted>/);
});

test("redacting executor streams stdout and stderr without changing the exit code", () => {
  const result = spawnSync(
    "python3",
    [
      "scripts/prod-smoke/redact_exec.py",
      "--",
      "python3",
      "-c",
      [
        "import sys",
        "print('GET /x?token=stdout-token password=stdout-password', flush=True)",
        "print(\"Authorization: Basic stderr-basic {'api_key': 'stderr-api-key'} known=known-exec-secret\", file=sys.stderr, flush=True)",
        "raise SystemExit(7)",
      ].join("; "),
    ],
    {
      cwd: new URL(repoRoot).pathname,
      env: {
        ...process.env,
        PYTHONLAB_SMOKE_PASSWORD: "known-exec-secret",
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 7, result.stderr || result.stdout);
  const combined = `${result.stdout}${result.stderr}`;
  assert.doesNotMatch(
    combined,
    /stdout-token|stdout-password|stderr-basic|stderr-api-key|known-exec-secret/,
  );
  assert.match(combined, /token=<redacted>/);
  assert.match(combined, /password=<redacted>/);
  assert.match(combined, /Basic <redacted>/);
  assert.match(combined, /'api_key': '<redacted>'/);
});

test(
  "redacting executor maps signal termination to the shell-compatible exit code",
  { skip: process.platform === "win32" },
  () => {
    const result = spawnSync(
      "python3",
      [
        "scripts/prod-smoke/redact_exec.py",
        "--",
        "python3",
        "-c",
        "import os, signal; os.kill(os.getpid(), signal.SIGTERM)",
      ],
      {
        cwd: new URL(repoRoot).pathname,
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 143, result.stderr || result.stdout);
  },
);

test("redacting executor redacts sensitive values split across lines", () => {
  const result = spawnSync(
    "python3",
    [
      "scripts/prod-smoke/redact_exec.py",
      "--",
      "python3",
      "-c",
      [
        "print('Authorization: Bearer', flush=True)",
        "print('split-line-secret', flush=True)",
        "raise SystemExit(7)",
      ].join("; "),
    ],
    {
      cwd: new URL(repoRoot).pathname,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 7, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, /split-line-secret/);
  assert.match(result.stdout, /<redacted>/);
});

test("redacting executor tolerates non-UTF-8 output without changing the exit code", () => {
  const result = spawnSync(
    "python3",
    [
      "scripts/prod-smoke/redact_exec.py",
      "--",
      "python3",
      "-c",
      "import sys; sys.stdout.buffer.write(b'bad=\\xff\\n'); sys.stdout.flush(); raise SystemExit(7)",
    ],
    {
      cwd: new URL(repoRoot).pathname,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 7, result.stderr || result.stdout);
  assert.match(result.stdout, /bad=/);
});

test(
  "redacting executor does not wait for a grandchild that inherited the output pipe",
  { skip: process.platform === "win32" },
  () => {
    const startedAt = Date.now();
    const result = spawnSync(
      "python3",
      [
        "scripts/prod-smoke/redact_exec.py",
        "--",
        "python3",
        "-c",
        [
          "import subprocess, sys",
          "subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(3)'])",
          "raise SystemExit(7)",
        ].join("; "),
      ],
      {
        cwd: new URL(repoRoot).pathname,
        encoding: "utf8",
      },
    );
    const elapsedMs = Date.now() - startedAt;

    assert.equal(result.status, 7, result.stderr || result.stdout);
    assert.ok(elapsedMs < 1500, `wrapper waited ${elapsedMs}ms for the grandchild`);
  },
);

test("frontend production install validates required browser runtime files", () => {
  const dockerfile = read("frontend/Dockerfile.prod");
  const dockerignore = read("frontend/.dockerignore");
  const viteConfig = read("frontend/vite.config.ts");
  const installLayer =
    dockerfile.match(/RUN env -u http_proxy([\s\S]*?)\n\nCOPY \. \./)?.[1] ?? "";
  const buildLayer =
    dockerfile.match(/RUN npm run build([\s\S]*?)\n\nFROM /)?.[0] ?? "";

  assert.match(installLayer, /npm ci/);
  for (const file of [
    "node_modules/pyodide/pyodide.js",
    "node_modules/pyodide/pyodide.mjs",
    "node_modules/pyodide/pyodide.asm.js",
    "node_modules/pyodide/pyodide.asm.wasm",
    "node_modules/pyodide/python_stdlib.zip",
    "node_modules/pyodide/pyodide-lock.json",
    "node_modules/pdfjs-dist/build/pdf.worker.js",
  ]) {
    assert.match(installLayer, new RegExp(`test -s ${file.replaceAll(".", "\\.")}`));
  }
  assert.match(buildLayer, /npm run build/);
  for (const file of [
    "build/pyodide/pyodide.js",
    "build/pyodide/pyodide.mjs",
    "build/pyodide/pyodide.asm.js",
    "build/pyodide/pyodide.asm.wasm",
    "build/pyodide/python_stdlib.zip",
    "build/pyodide/pyodide-lock.json",
    "build/assets/pdf.worker.js",
  ]) {
    assert.match(buildLayer, new RegExp(`test -s ${file.replaceAll(".", "\\.")}`));
  }
  assert.match(dockerignore, /^public\/pyodide\/?$/m);
  assert.match(
    viteConfig,
    /catch \(error\) \{[\s\S]*console\.error\("Failed to copy PDF worker file:", error\);[\s\S]*throw error;/,
  );
});

test("backend production builds use configurable Debian mirrors", () => {
  const dockerfile = read("backend/Dockerfile.prod");
  const compose = read("docker-compose.yml");
  const envExample = read(".env.example");

  assert.match(dockerfile, /ARG DEBIAN_MIRROR=http:\/\/deb\.debian\.org\/debian/);
  assert.match(
    dockerfile,
    /ARG DEBIAN_SECURITY_MIRROR=http:\/\/deb\.debian\.org\/debian-security/,
  );
  assert.match(
    dockerfile,
    /sed -i[\s\S]*DEBIAN_MIRROR[\s\S]*DEBIAN_SECURITY_MIRROR[\s\S]*debian\.sources/,
  );
  assert.equal(
    (compose.match(/DEBIAN_MIRROR: \$\{DEBIAN_MIRROR:-https:\/\/mirrors\.aliyun\.com\/debian\}/g) ?? []).length,
    3,
  );
  assert.equal(
    (
      compose.match(
        /DEBIAN_SECURITY_MIRROR: \$\{DEBIAN_SECURITY_MIRROR:-https:\/\/mirrors\.aliyun\.com\/debian-security\}/g,
      ) ?? []
    ).length,
    3,
  );
  assert.match(envExample, /^DEBIAN_MIRROR=https:\/\/mirrors\.aliyun\.com\/debian$/m);
  assert.match(
    envExample,
    /^DEBIAN_SECURITY_MIRROR=https:\/\/mirrors\.aliyun\.com\/debian-security$/m,
  );
});

test("verify-release-set accepts a complete release set with matching compose and registry digests", () => {
  const result = runDeployWithFakeDocker({ releaseSet: makeReleaseSet() });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /release-set verified/);
});

test("verify-release-set rejects missing, duplicate, or tag-mismatched release rows", () => {
  const missing = runDeployWithFakeDocker({
    releaseSet: makeReleaseSet({ rows: requiredReleaseImages.slice(0, -1) }),
  });
  const duplicate = runDeployWithFakeDocker({
    releaseSet: makeReleaseSet({ rows: [...requiredReleaseImages, "wangsh-backend"] }),
  });
  const tagMismatch = runDeployWithFakeDocker({
    releaseSet: makeReleaseSet({ version: "1.5.9" }),
  });

  assert.notEqual(missing.status, 0);
  assert.match(`${missing.stderr}${missing.stdout}`, /six|required|missing/i);
  assert.notEqual(duplicate.status, 0);
  assert.match(`${duplicate.stderr}${duplicate.stdout}`, /duplicate/i);
  assert.notEqual(tagMismatch.status, 0);
  assert.match(`${tagMismatch.stderr}${tagMismatch.stdout}`, /version|tag/i);
});

test("verify-release-set rejects compose reference and registry digest drift", () => {
  const composeDrift = runDeployWithFakeDocker({
    releaseSet: makeReleaseSet(),
    composeImages: [
      "shuhao07/wangsh-backend:1.5.9",
      "shuhao07/wangsh-typst-worker:1.6.0",
      "shuhao07/wangsh-pythonlab-worker:1.6.0",
      "shuhao07/pythonlab-sandbox:1.6.0",
      "shuhao07/wangsh-frontend:1.6.0",
      "shuhao07/wangsh-gateway:1.6.0",
    ],
  });
  const digestDrift = runDeployWithFakeDocker({
    releaseSet: makeReleaseSet(),
    dockerDigestOverrides: { "wangsh-backend": "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" },
  });

  assert.notEqual(composeDrift.status, 0);
  assert.match(`${composeDrift.stderr}${composeDrift.stdout}`, /compose|reference|image/i);
  assert.notEqual(digestDrift.status, 0);
  assert.match(`${digestDrift.stderr}${digestDrift.stdout}`, /digest/i);
});

test("verify-release-set rejects logical image swaps and version variable drift", () => {
  const swapped = runDeployWithFakeDocker({
    releaseSet: makeReleaseSet({
      refOverrides: {
        "wangsh-backend": "shuhao07/wangsh-typst-worker:1.6.0",
        "wangsh-typst-worker": "shuhao07/wangsh-backend:1.6.0",
      },
    }),
  });
  const versionDrift = runDeployWithFakeDocker({
    releaseSet: makeReleaseSet(),
    envOverrides: { REACT_APP_VERSION: "1.5.9" },
  });

  assert.notEqual(swapped.status, 0);
  assert.match(`${swapped.stderr}${swapped.stdout}`, /name|mapping|backend|worker/i);
  assert.notEqual(versionDrift.status, 0);
  assert.match(`${versionDrift.stderr}${versionDrift.stdout}`, /REACT_APP_VERSION|version/i);
});

test("up-no-build rejects local images that do not match the release set", () => {
  const result = runDeployWithFakeDocker({
    command: "up-no-build",
    releaseSet: makeReleaseSet(),
    localDigestOverrides: {
      "wangsh-backend":
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /local.*digest|digest.*local/i);
  assert.doesNotMatch(result.dockerLog, / up -d --no-build/);
});

test("pull-up verifies pulled image digests before starting services", () => {
  const result = runDeployWithFakeDocker({
    command: "pull-up",
    releaseSet: makeReleaseSet(),
    localDigestOverrides: {
      "wangsh-frontend":
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.dockerLog, / pull/);
  assert.doesNotMatch(result.dockerLog, / up -d --no-build/);
});

test("pull-up only pulls release services and starts without implicit pulls", () => {
  const result = runDeployWithFakeDocker({
    command: "pull-up",
    releaseSet: makeReleaseSet(),
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.dockerLog,
    / pull backend typst-worker pythonlab-worker pythonlab-sandbox frontend gateway/,
  );
  assert.doesNotMatch(result.dockerLog, /pull.*(?:postgres|redis)/);
  assert.match(result.dockerLog, / up -d --no-build --pull never/);
});

test("PythonLab PR wrappers execute the checked-out PR runtime", () => {
  const ownerGate = read(".github/workflows/pr-pythonlab-owner-gate.yml");
  const phasecGate = read(".github/workflows/pr-pythonlab-phasec-gate.yml");

  assert.match(ownerGate, /uses:\s*\.\/\.github\/workflows\/pythonlab-pr-runtime\.yml/);
  assert.match(ownerGate, /mode:\s*owner/);
  assert.match(phasecGate, /uses:\s*\.\/\.github\/workflows\/pythonlab-pr-runtime\.yml/);
  assert.match(phasecGate, /mode:\s*phasec/);
  assert.doesNotMatch(ownerGate, /head\.repo\.fork/);
  assert.doesNotMatch(phasecGate, /head\.repo\.fork/);
  assert.doesNotMatch(ownerGate, /-\s*"frontend\/src\/\*\*"/);
  assert.doesNotMatch(phasecGate, /-\s*"frontend\/src\/\*\*"/);
  assert.match(ownerGate, /frontend\/src\/lib\/monacoWorkers\.ts/);
  assert.match(phasecGate, /frontend\/src\/lib\/monacoWorkers\.ts/);
});

test("PythonLab PR runtime provisions, verifies, and cleans local dependencies", () => {
  const workflow = read(".github/workflows/pythonlab-pr-runtime.yml");

  for (const required of [
    "postgres:",
    "redis:",
    "build PythonLab sandbox",
    "start current PR backend and worker",
    "wait for current PR runtime",
    "(cd backend && celery",
    "API_URL: http://127.0.0.1:8000",
    "if: ${{ always() }}",
    "cleanup current PR runtime",
    "setup-node@v4",
    "npm ci",
    "Install Playwright Chromium",
    "pythonlab-debug-smoke.mjs",
    "--scenario debug-happy-path",
    "--scenario debug-multi-breakpoint-continue-to-end",
    "pointer",
  ]) {
    assert.ok(workflow.includes(required), `missing workflow contract: ${required}`);
  }
  assert.doesNotMatch(workflow, /secrets:\s*[\s\S]*PYTHONLAB_SMOKE_PASSWORD/);
  const secretKey = workflow.match(/SECRET_KEY:\s*(\S+)/)?.[1] ?? "";
  assert.ok(secretKey.length >= 32, "PythonLab CI SECRET_KEY must be at least 32 characters");

  const steps = [
    "setup-node@v4",
    "npm ci",
    "Install Playwright Chromium",
    "start current PR Vite",
    "wait for current PR frontend",
    "run frontend PythonLab pointer-click smoke",
    "--scenario debug-happy-path",
    "--scenario debug-multi-breakpoint-continue-to-end",
    "cleanup current PR runtime",
  ].map((marker) => workflow.indexOf(marker));
  for (let index = 1; index < steps.length; index += 1) {
    assert.ok(
      steps[index - 1] >= 0 && steps[index] > steps[index - 1],
      `PythonLab frontend execution chain is out of order near ${index}`,
    );
  }
  assert.match(workflow, /npm run dev -- --host 127\.0\.0\.1 --port 6608/);
  assert.match(workflow, /--base-url http:\/\/127\.0\.0\.1:6608/);
});

test("PythonLab PR gates rerun when shared prod-smoke redaction changes", () => {
  for (const workflow of [
    read(".github/workflows/pr-pythonlab-owner-gate.yml"),
    read(".github/workflows/pr-pythonlab-phasec-gate.yml"),
  ]) {
    assert.match(workflow, /scripts\/prod-smoke\/\*\*/);
  }
});

test("Phase C soak redacts every per-round log before writing it", () => {
  const soak = read("backend/scripts/soak_pythonlab_phasec.py");

  assert.match(soak, /REDACTOR_PATH/);
  assert.match(soak, /redact_for_log\(output\)/);
  assert.match(soak, /redacted_output/);
  assert.doesNotMatch(soak, /log_path\.write_text\(output,/);
});

test("CI runs repository governance gates", () => {
  const workflow = read(".github/workflows/ci-quality.yml");

  for (const required of [
    "python scripts/check_python_governance.py check",
    "fetch-depth: 0",
    "PUSH_BEFORE_SHA",
    "WORKFLOW_CALL_BASE_REF",
    '"$EVENT_NAME" = "workflow_call"',
    "npm run -s test:scripts",
    "npm run -s token:check:ci",
    "scripts/rollback.sh",
    "scripts/migrate-db.sh",
    "scripts/health-check-detailed.sh",
    "scripts/prod-smoke/run.sh",
    "start-dev.sh",
    "stop-dev.sh",
  ]) {
    assert.ok(workflow.includes(required), `missing CI governance gate: ${required}`);
  }
});

test("CI validates every maintained shell entry separately", () => {
  const workflow = read(".github/workflows/ci-quality.yml");

  assert.match(
    workflow,
    /for script in[\s\S]*?scripts\/deploy\.sh[\s\S]*?scripts\/rollback\.sh[\s\S]*?scripts\/migrate-db\.sh[\s\S]*?scripts\/health-check-detailed\.sh[\s\S]*?scripts\/prod-smoke\/run\.sh[\s\S]*?start-dev\.sh[\s\S]*?stop-dev\.sh[\s\S]*?do[\s\S]*?bash -n "\$script"[\s\S]*?done/,
  );
  assert.doesNotMatch(
    workflow,
    /bash -n scripts\/deploy\.sh\s+scripts\/rollback\.sh/,
  );
});

test("version consistency rejects drift in production and release defaults", () => {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-version-contract-"));
  const frontendDirectory = join(directory, "frontend");
  const scriptsDirectory = join(directory, "scripts");
  const workflowsDirectory = join(directory, ".github", "workflows");

  mkdirSync(frontendDirectory, { recursive: true });
  mkdirSync(scriptsDirectory, { recursive: true });
  mkdirSync(workflowsDirectory, { recursive: true });
  writeFileSync(join(frontendDirectory, "package.json"), '{"version":"1.6.0"}\n');
  writeFileSync(join(frontendDirectory, "package-lock.json"), '{"version":"1.6.0"}\n');
  writeFileSync(
    join(directory, ".env.example"),
    "APP_VERSION=1.6.0\nIMAGE_TAG=1.6.0\nREACT_APP_VERSION=1.6.0\n",
  );
  writeFileSync(
    join(directory, "docker-compose.yml"),
    "services:\n  backend:\n    image: repo/wangsh-backend:${IMAGE_TAG:-1.5.9}\n",
  );
  writeFileSync(
    join(scriptsDirectory, "deploy.sh"),
    'sim_version="${SIM_VERSION:-1.6.0}"\n',
  );
  writeFileSync(
    join(workflowsDirectory, "dockerhub-amd64.yml"),
    'image_tag:\n  default: "1.6.0"\n',
  );

  const result = spawnSync("node", ["scripts/check-version-consistency.mjs"], {
    cwd: new URL(repoRoot).pathname,
    env: {
      ...process.env,
      VERSION_CHECK_ROOT: directory,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /docker-compose\.yml IMAGE_TAG default/);
});

test("manual health and Typst smoke defaults match the production gateway", () => {
  const deploy = read("scripts/deploy.sh");
  const healthCheck = read("scripts/health-check-detailed.sh");
  const typstSmoke = read("backend/scripts/smoke_typst_pipeline.py");

  assert.match(healthCheck, /http:\/\/localhost:\$\{WEB_PORT:-6608\}/);
  assert.match(healthCheck, /check_container "frontend"/);
  assert.match(healthCheck, /check_container "gateway"/);
  assert.match(healthCheck, /\[\[ "\$frontend_status" != "ok" \]\]/);
  assert.match(healthCheck, /\[\[ "\$gateway_status" != "ok" \]\]/);
  assert.match(healthCheck, /\[\[ "\$typst_status" != "ok" \]\]/);
  assert.match(healthCheck, /\[\[ "\$pythonlab_status" != "ok" \]\]/);
  assert.match(healthCheck, /docker inspect --format '\{\{\.State\.Status\}\}'/);
  assert.match(
    healthCheck,
    /docker compose "\$\{compose_args\[@\]\}" exec -T backend python -c/,
  );
  assert.doesNotMatch(healthCheck, /\bpython3\b/);
  assert.doesNotMatch(healthCheck, /json_status_is_healthy/);
  assert.doesNotMatch(healthCheck, /\$health" == "none"/);
  assert.match(deploy, /curl -fsS "http:\/\/localhost:\$\{web_port\}\/"/);
  assert.match(typstSmoke, /http:\/\/localhost:6608\/api\/v1/);
});

test("production detailed-health services all define Compose healthchecks", () => {
  for (const service of detailedHealthContainerServices) {
    const serviceBody = composeServiceBody("docker-compose.yml", service);
    assert.ok(serviceBody, `missing production Compose service: ${service}`);
    assert.match(
      serviceBody,
      /^\s+healthcheck:\s*$/m,
      `missing healthcheck for production service: ${service}`,
    );
  }
});

test("detailed health validates 2xx JSON through backend container stdin", () => {
  for (const httpStatus of [200, 299]) {
    const result = runDetailedHealthCheck({
      httpStatus,
      response: healthyHealthResponse,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).checks.api, "ok");
    assert.equal(result.composeExecLog, "exec\n");
    assert.equal(result.composeExecInput, healthyHealthResponse);
    assert.equal(result.python3Log, "");
  }

  for (const fixture of [
    {
      expectExec: false,
      httpStatus: 300,
      response: '{"status":"healthy"}',
    },
    {
      expectExec: false,
      httpStatus: 401,
      response: '{"status":"healthy"}',
    },
    {
      expectExec: false,
      httpStatus: 503,
      response: '{"status":"healthy"}',
    },
    {
      composeExecStatus: 1,
      expectExec: true,
      httpStatus: 200,
      response: '{"status":"unhealthy"}',
    },
    {
      composeExecStatus: 1,
      expectExec: true,
      httpStatus: 200,
      response: '{"status":',
    },
    {
      composeExecStatus: 1,
      expectExec: true,
      httpStatus: 200,
      response: '{"status":"healthy","status":"healthy"}',
    },
    {
      composeExecStatus: 1,
      expectExec: true,
      httpStatus: 200,
      response: "[]",
    },
    {
      composeExecStatus: 1,
      expectExec: true,
      httpStatus: 200,
      response: "",
    },
    {
      composeExecStatus: 125,
      expectExec: true,
      httpStatus: 200,
      response: healthyHealthResponse,
    },
    {
      curlStatus: 7,
      expectExec: false,
      httpStatus: 0,
      response: "",
    },
  ]) {
    const result = runDetailedHealthCheck(fixture);
    assert.equal(
      result.status,
      1,
      `accepted ${JSON.stringify(fixture)}\n${result.stderr}\n${result.stdout}`,
    );
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "unhealthy");
    assert.equal(report.checks.api, "failed");
    assert.equal(result.composeExecLog, fixture.expectExec ? "exec\n" : "");
    assert.equal(
      result.composeExecInput,
      fixture.expectExec ? fixture.response : "",
    );
    assert.equal(result.python3Log, "");
  }
});

test("detailed health rejects required containers without Docker health", () => {
  const result = runDetailedHealthCheck({
    containerWithoutHealth: "frontend",
    httpStatus: 200,
    response: healthyHealthResponse,
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks.api, "ok");
  assert.equal(report.checks.frontend, "failed");
  assert.equal(result.python3Log, "");
});

test("compose backend healthchecks require HTTP 2xx and healthy JSON", () => {
  for (const composePath of ["docker-compose.yml", "docker-compose.dev.yml"]) {
    for (const httpStatus of [200, 299]) {
      const result = runComposeBackendHealthcheck(composePath, {
        httpStatus,
        response: healthyHealthResponse,
      });
      assert.equal(
        result.status,
        0,
        `${composePath}: ${result.stderr}\n${result.stdout}`,
      );
      assert.match(result.closeLog, /^closed\n$/);
    }

    for (const fixture of [
      { httpStatus: 300, response: '{"status":"healthy"}' },
      { httpStatus: 401, response: '{"status":"healthy"}' },
      { httpStatus: 503, response: '{"status":"healthy"}' },
      { httpStatus: 200, response: '{"status":"unhealthy"}' },
      { httpStatus: 200, response: '{"status":' },
      {
        httpStatus: 200,
        response: '{"status":"healthy","status":"healthy"}',
      },
      { httpStatus: 200, response: '[["status","healthy"]]' },
      { httpStatus: 200, response: "" },
      {
        connectionError: true,
        httpStatus: 0,
        response: "",
      },
    ]) {
      const result = runComposeBackendHealthcheck(composePath, fixture);
      assert.notEqual(
        result.status,
        0,
        `${composePath} accepted ${JSON.stringify(fixture)}`,
      );
      assert.match(result.closeLog, /^closed\n$/);
    }
  }
});

test("local development PostgreSQL readiness targets the configured database", () => {
  const startDev = read("start-dev.sh");

  assert.match(
    startDev,
    /pg_isready -U "\$\{POSTGRES_USER:-admin\}" -d "\$\{POSTGRES_DB:-wangsh_db\}"/,
  );
});

test("destructive deploy commands stop before Docker Compose without explicit confirmation", () => {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-deploy-confirmation-contract-"));
  const scriptsDirectory = join(directory, "scripts");
  const dockerFile = join(directory, "docker");
  const envFile = join(directory, ".env");
  const composeFile = join(directory, "compose.yml");
  const dumpFile = join(directory, "backup.dump");

  mkdirSync(scriptsDirectory);
  writeFileSync(envFile, "\n");
  writeFileSync(composeFile, "services: {}\n");
  writeFileSync(dumpFile, "fixture");
  writeFileSync(join(scriptsDirectory, "deploy.sh"), read("scripts/deploy.sh"));
  chmodSync(join(scriptsDirectory, "deploy.sh"), 0o755);
  writeFileSync(
    dockerFile,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "info" ]]; then
  exit 0
fi
echo "unexpected Docker call before confirmation: $*" >&2
exit 99
`,
  );
  chmodSync(dockerFile, 0o755);

  const env = {
    ...process.env,
    PATH: `${directory}:${process.env.PATH}`,
    ENV_FILE: envFile,
    COMPOSE_FILE: composeFile,
    COMPOSE_PROJECT_NAME: "wangsh_prod",
  };
  const downResult = spawnSync("bash", ["scripts/deploy.sh", "down-v"], {
    cwd: directory,
    env,
    encoding: "utf8",
  });
  const restoreResult = spawnSync(
    "bash",
    ["scripts/deploy.sh", "restore-db", dumpFile],
    {
      cwd: directory,
      env,
      encoding: "utf8",
    },
  );

  assert.equal(downResult.status, 2, `${downResult.stderr}\n${downResult.stdout}`);
  assert.match(downResult.stderr, /Refusing to delete Compose volumes/);
  assert.equal(restoreResult.status, 2, `${restoreResult.stderr}\n${restoreResult.stdout}`);
  assert.match(restoreResult.stderr, /Refusing destructive restore/);
});

test("rollback stops write services before backing up and downgrading", () => {
  const result = runRollback();
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /Stopping application write services/);
  assert.match(result.stdout, /Creating backup inside the no-write window/);
  assert.match(result.stdout, /Rolling back to: target_revision/);
  assert.doesNotMatch(result.stderr, /local: can only be used in a function/);
  assert.doesNotMatch(result.stderr, /skipping backup/i);
  const runningServicesIndex = result.operations.indexOf(
    " ps --status running --services backend typst-worker pythonlab-worker",
  );
  const backupIndex = result.operations.indexOf("backup");
  const stopIndex = result.operations.indexOf(
    " stop backend typst-worker pythonlab-worker",
  );
  const downgradeIndex = result.operations.indexOf(
    " run --rm --no-deps backend alembic downgrade target_revision",
  );

  assert.ok(runningServicesIndex >= 0, result.operations);
  assert.ok(backupIndex >= 0, result.operations);
  assert.ok(stopIndex >= 0, result.operations);
  assert.ok(downgradeIndex >= 0, result.operations);
  assert.ok(
    runningServicesIndex < stopIndex,
    result.operations,
  );
  assert.ok(
    stopIndex < backupIndex,
    result.operations,
  );
  assert.ok(
    backupIndex < downgradeIndex,
    result.operations,
  );
  assert.doesNotMatch(result.operations, / exec backend alembic downgrade/);
});

test("rollback backup failure restarts only originally running write services", () => {
  const result = runRollback({
    backupStatus: 17,
    runningWriteServices: ["backend", "pythonlab-worker"],
  });

  assert.equal(result.status, 17, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stderr, /backup failed with status 17/i);
  assert.match(result.stderr, /no database downgrade was attempted/i);
  assert.match(result.stdout, /Restarting originally running application write services/);
  assert.match(result.stdout, /Application write services restored/);
  const stopIndex = result.operations.indexOf(
    " stop backend typst-worker pythonlab-worker",
  );
  const backupIndex = result.operations.indexOf("backup");
  const restartIndex = result.operations.indexOf(
    " start backend pythonlab-worker",
  );

  assert.ok(stopIndex >= 0, result.operations);
  assert.ok(backupIndex > stopIndex, result.operations);
  assert.ok(restartIndex > backupIndex, result.operations);
  assert.doesNotMatch(result.operations, / start typst-worker/);
  assert.doesNotMatch(result.operations, /alembic downgrade/);
});

test("rollback stop failure restores original services without backup or downgrade", () => {
  const result = runRollback({
    runningWriteServices: ["backend", "typst-worker"],
    stopStatus: 19,
  });

  assert.equal(result.status, 19, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stderr, /stopping application write services failed with status 19/i);
  assert.match(result.stderr, /no database downgrade was attempted/i);
  assert.match(result.operations, / stop backend typst-worker pythonlab-worker/);
  assert.match(result.operations, / start backend typst-worker/);
  assert.doesNotMatch(result.operations, /^backup$/m);
  assert.doesNotMatch(result.operations, /alembic downgrade/);
});

test("rollback reports backup and service recovery failures without downgrading", () => {
  const result = runRollback({
    backupStatus: 17,
    restartStatus: 23,
    runningWriteServices: ["backend", "typst-worker"],
  });

  assert.equal(result.status, 23, `${result.stderr}\n${result.stdout}`);
  assert.match(result.operations, / start backend typst-worker/);
  assert.doesNotMatch(result.operations, /alembic downgrade/);
  assert.match(result.stderr, /backup failed with status 17/i);
  assert.match(
    result.stderr,
    /failed to restart original application write services \(status 23\)/i,
  );
  assert.match(result.stderr, /manual recovery required/i);
  assert.match(result.stderr, /no database downgrade was attempted/i);
});

test("rollback --no-backup explicitly stops services and downgrades", () => {
  const result = runRollback({ noBackup: true });

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /DANGER: --no-backup skips the rollback backup/i);
  assert.doesNotMatch(result.operations, /^backup$/m);
  assert.match(
    result.operations,
    / stop backend typst-worker pythonlab-worker/,
  );
  assert.match(
    result.operations,
    / run --rm --no-deps backend alembic downgrade target_revision/,
  );
});

test("rollback rejects conflicting backup flags before touching Docker", () => {
  for (const rollbackOptions of [
    ["--backup", "--no-backup"],
    ["--no-backup", "--backup"],
  ]) {
    const result = runRollback({ rollbackOptions });

    assert.equal(result.status, 2, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stderr, /--backup and --no-backup cannot be used together/);
    assert.equal(result.operations, "");
  }
});

test("rollback rejects unknown options before touching Docker", () => {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-rollback-options-contract-"));
  const scriptsDirectory = join(directory, "scripts");
  const outsideDirectory = join(directory, "outside");

  mkdirSync(scriptsDirectory);
  mkdirSync(outsideDirectory);
  writeFileSync(join(scriptsDirectory, "rollback.sh"), read("scripts/rollback.sh"));
  chmodSync(join(scriptsDirectory, "rollback.sh"), 0o755);

  const invalidResult = spawnSync(
    "bash",
    [join(scriptsDirectory, "rollback.sh"), "rollback", "--bakcup"],
    {
      cwd: outsideDirectory,
      env: {
        ...process.env,
        PATH: process.env.PATH,
      },
      encoding: "utf8",
    },
  );
  assert.equal(invalidResult.status, 2);
  assert.match(invalidResult.stderr, /unknown rollback option/i);
});

test("XBK seed is safe by default and idempotent", () => {
  const runAll = read("scripts/xbk/run_all.py");
  const seed = read("scripts/xbk/seed.py");

  assert.match(runAll, /"--reset"/);
  assert.doesNotMatch(runAll, /"--no-reset"/);
  assert.match(seed, /reset: bool = False/);
  assert.match(seed, /ON CONFLICT \(year, term, student_no\) DO UPDATE/);
  assert.match(seed, /ON CONFLICT \(year, term, course_code\) DO UPDATE/);
  assert.match(seed, /ON CONFLICT \(year, term, student_no, course_code\) DO UPDATE/);
});

test("backend CI exposes complete test settings to migrations and pytest", () => {
  const workflow = read(".github/workflows/ci-quality.yml");
  const backendJob = workflow.match(
    /  backend-pytest:[\s\S]*?(?=\n  frontend-quality:)/,
  )?.[0];

  assert.ok(backendJob, "backend-pytest job is missing");
  assert.match(backendJob, /runs-on:\s*ubuntu-latest\n    env:\n[\s\S]*?\n    services:/);

  for (const required of [
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "SECRET_KEY",
    "SUPER_ADMIN_PASSWORD",
    "AGENT_API_KEY_ENCRYPTION_KEY",
  ]) {
    assert.match(
      backendJob,
      new RegExp(`^      ${required}:`, "m"),
      `backend CI job env is missing ${required}`,
    );
  }

  const envValue = (name) =>
    backendJob.match(new RegExp(`^      ${name}:\\s*"?([^"\\n]+)"?`, "m"))?.[1]?.trim() ?? "";
  for (const required of [
    "POSTGRES_PASSWORD",
    "SECRET_KEY",
    "SUPER_ADMIN_PASSWORD",
    "AGENT_API_KEY_ENCRYPTION_KEY",
  ]) {
    const value = envValue(required);
    assert.ok(value, `backend CI job env has an empty ${required}`);
    assert.notEqual(value, "change_me", `backend CI job env uses default ${required}`);
  }

  assert.ok(envValue("SECRET_KEY").length >= 32, "backend CI SECRET_KEY is too short");
  assert.match(
    envValue("AGENT_API_KEY_ENCRYPTION_KEY"),
    /^[A-Za-z0-9_-]{43}=$/,
    "backend CI agent encryption key must be a Fernet-compatible test key",
  );
});

test("frontend chart dependencies use a compatible ECharts peer major", () => {
  const packageJson = JSON.parse(read("frontend/package.json"));
  const packageLock = JSON.parse(read("frontend/package-lock.json"));
  const echartsRange = packageJson.dependencies?.echarts ?? "";
  const lockedEchartsVersion =
    packageLock.packages?.["node_modules/echarts"]?.version ?? "";
  const wordCloudPeer =
    packageLock.packages?.["node_modules/echarts-wordcloud"]?.peerDependencies?.echarts ?? "";
  const echartsMajor = echartsRange.match(/\d+/)?.[0];
  const lockedEchartsMajor = lockedEchartsVersion.match(/\d+/)?.[0];
  const peerMajor = wordCloudPeer.match(/\d+/)?.[0];

  assert.ok(echartsMajor, "frontend ECharts dependency range is missing");
  assert.ok(lockedEchartsMajor, "frontend ECharts lockfile version is missing");
  assert.ok(wordCloudPeer, "echarts-wordcloud peer dependency is missing from the lockfile");
  assert.equal(
    lockedEchartsMajor,
    echartsMajor,
    `lockfile ECharts ${lockedEchartsVersion} does not match package range ${echartsRange}`,
  );
  assert.equal(
    echartsMajor,
    peerMajor,
    `echarts ${echartsRange} does not satisfy echarts-wordcloud peer ${wordCloudPeer}`,
  );
});
