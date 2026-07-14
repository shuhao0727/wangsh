import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

function runDeployWithFakeDocker({ releaseSet, composeImages = null, dockerDigestOverrides = {} }) {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-release-set-contract-"));
  const envFile = join(directory, ".env");
  const composeFile = join(directory, "compose.yml");
  const releaseSetFile = join(directory, "release-set.txt");
  const dockerFile = join(directory, "docker");
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

  writeFileSync(
    envFile,
    [
      "APP_VERSION=1.6.0",
      "IMAGE_TAG=1.6.0",
      "IMAGE_REPOSITORY_PREFIX=shuhao07",
      "IMAGE_NAME_BACKEND=wangsh-backend",
      "IMAGE_NAME_WORKER=wangsh-typst-worker",
      "IMAGE_NAME_PYTHONLAB_WORKER=wangsh-pythonlab-worker",
      "IMAGE_NAME_GATEWAY=wangsh-gateway",
      "PYTHONLAB_SANDBOX_IMAGE=shuhao07/pythonlab-sandbox:1.6.0",
      "",
    ].join("\n"),
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
APP_VERSION=1.6.0
IMAGE_TAG=1.6.0
IMAGE_REPOSITORY_PREFIX=shuhao07
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
echo "unexpected fake docker invocation: $*" >&2
exit 1
`,
  );
  chmodSync(dockerFile, 0o755);

  const result = spawnSync(
    "bash",
    ["scripts/deploy.sh", "verify-release-set", releaseSetFile],
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
  return { ...result, directory };
}

function makeReleaseSet({ version = "1.6.0", rows = requiredReleaseImages, digest = null } = {}) {
  const lines = ["format=wangsh-release-set-v1", `version=${version}`];
  for (const image of rows) {
    const ref = `shuhao07/${image}:${version}`;
    const imageDigest = digest ?? defaultDigest;
    lines.push(`image=${image} ref=${ref} digest=${imageDigest}`);
  }
  return `${lines.join("\n")}\n`;
}

test("docker publish validates source version and does not default to latest", () => {
  const workflow = read(".github/workflows/dockerhub-amd64.yml");

  assert.match(workflow, /push_latest:[\s\S]*?default:\s*"false"/);
  assert.match(workflow, /RELEASE_TAG:\s*\$\{\{\s*inputs\.image_tag\s*\}\}/);
  assert.match(workflow, /validate image tag against source version/);
  assert.match(workflow, /frontend\/package\.json/);
  assert.doesNotMatch(workflow, /run:\s*\|[\s\S]*?\$\{\{\s*inputs\.image_tag\s*\}\}/);
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

test("formal deploy and pull-up consume release-set before compose pull/up", () => {
  const deploy = read("scripts/deploy.sh");
  const upNoBuildBody =
    deploy.match(/up-no-build\)([\s\S]*?)\n\s*;;/)?.[1] ?? "";

  assert.match(deploy, /verify-release-set/);
  assert.match(deploy, /pull-up\)[\s\S]*verify_release_set[\s\S]*compose pull[\s\S]*compose up -d --no-build/);
  assert.match(deploy, /deploy\)[\s\S]*bash scripts\/deploy\.sh pull-up/);
  assert.match(upNoBuildBody, /verify_release_set/);
  assert.match(upNoBuildBody, /compose up -d --no-build/);
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
  ]) {
    assert.ok(workflow.includes(required), `missing CI governance gate: ${required}`);
  }
});
