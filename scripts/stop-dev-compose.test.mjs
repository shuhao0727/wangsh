import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const source = readFileSync(new URL("../stop-dev.sh", import.meta.url), "utf8");
const start = source.indexOf("stop_dev_compose() {");
const end = source.indexOf("# 函数：显示当前状态", start);
assert(start >= 0 && end > start, "stop Compose functions must be extractable without running main");
const functions = source.slice(start, end);

function exercise({
  mockWorkingDir = "",
  allowCrossDir = false,
  envFiles = true,
  sameDir = false,
  prodProjectName = "",
  crossDirFor = "",
  psFail = false,
} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "wangsh-stop-compose-"));
  const trace = path.join(root, "trace");
  const projectName = path.basename(root).toLowerCase();
  const prodProject = prodProjectName || projectName;
  const effectiveCrossDir = sameDir ? "dev" : crossDirFor;
  const psProject = effectiveCrossDir === "prod" ? prodProject : effectiveCrossDir === "dev" ? projectName : "";
  if (envFiles) {
    writeFileSync(path.join(root, ".env.dev"), "POSTGRES_DB=fixture\n");
    writeFileSync(path.join(root, ".env.local"), "# personal\n");
    const envBody = `POSTGRES_DB=fixture\n${prodProjectName ? `COMPOSE_PROJECT_NAME=${prodProjectName}\n` : ""}`;
    writeFileSync(path.join(root, ".env"), envBody);
  }
  writeFileSync(path.join(root, "docker-compose.dev.yml"), "services: {}\n");
  writeFileSync(path.join(root, "docker-compose.yml"), "services: {}\n");
  const harness = `set -euo pipefail
PROJECT_ROOT="$(cd "${root}" && pwd -P)"
MOCK_TRACE="${trace}"
MOCK_WORKING_DIR="${sameDir ? "__PROJECT_ROOT__" : mockWorkingDir}"
MOCK_PROJECT="${psProject}"
MOCK_DEV_PROJECT="${projectName}"
MOCK_PROD_PROJECT="${prodProject}"
MOCK_PS_FAIL=${psFail ? "true" : "false"}
ALLOW_CROSS_DIR_STOP=${allowCrossDir ? "true" : "false"}
print_info() { :; }
print_warning() { :; }
print_success() { :; }
print_error() { printf '%s\\n' "$*" >&2; }
sleep() { :; }
env() {
  if [[ "$*" == *" config --format json"* ]]; then
    local name
    case "$*" in
      *docker-compose.dev.yml*) name="\${MOCK_DEV_PROJECT}" ;;
      *docker-compose.yml*) name="\${MOCK_PROD_PROJECT}" ;;
      *) name="\${MOCK_DEV_PROJECT}" ;;
    esac
    printf '{"name":"%s","services":{"fixture":{}}}\\n' "\${name}"
    return 0
  fi
  printf 'ENV %s\\n' "$*" >> "$MOCK_TRACE"
}
docker() {
  case "$*" in
    info*) return 0 ;;
    ps*--filter*)
      if [ "\${MOCK_PS_FAIL}" = "true" ]; then return 1; fi
      if [ -n "\${MOCK_WORKING_DIR}" ]; then
        if [ "\${MOCK_WORKING_DIR}" = "__PROJECT_ROOT__" ]; then
          MOCK_WORKING_DIR="\${PROJECT_ROOT}"
        fi
        if [ -z "\${MOCK_PROJECT}" ] || [[ "$*" == *"label=com.docker.compose.project=\${MOCK_PROJECT}"* ]]; then
          printf '%s\\n' "\${MOCK_WORKING_DIR}"
        fi
      fi
      ;;
    ps*) : ;;
    *) printf 'UNEXPECTED_DOCKER %s\\n' "$*" >> "$MOCK_TRACE"; return 99 ;;
  esac
}
${functions}
stop_docker_containers
`;
  try {
    const result = spawnSync("bash", ["-c", harness], {
      env: { PATH: "/usr/bin:/bin", HOME: root },
      encoding: "utf8",
    });
    const traceText = existsSync(trace) ? readFileSync(trace, "utf8") : "";
    return {
      status: result.status,
      stderr: result.stderr,
      calls: traceText.trim() ? traceText.trim().split("\n") : [],
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("stop uses explicit dev/prod files and clears inherited Compose selectors", () => {
  const result = exercise();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 2, result.calls.join("\n"));
  assert.match(result.calls[0], /-u COMPOSE_FILE -u COMPOSE_PROJECT_NAME/);
  assert.match(result.calls[0], /--env-file .*\.env\.dev --env-file .*\.env\.local -f .*docker-compose\.dev\.yml down --remove-orphans/);
  assert.match(result.calls[1], /--env-file .*\.env -f .*docker-compose\.yml down --remove-orphans/);
});

test("missing dev env files do not invent paths or break container shutdown", () => {
  const result = exercise({ envFiles: false });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 2);
  assert.doesNotMatch(result.calls[0], /--env-file/);
  assert.doesNotMatch(result.calls[1], /--env-file/);
});

test("refuses to stop a project whose containers were created from another directory", () => {
  const result = exercise({
    crossDirFor: "dev",
    mockWorkingDir: "/srv/wangsh-releases/2.2.10/source",
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.calls.length, 0, result.calls.join("\n"));
  assert.match(result.stderr, /--include-prod/);
});

test("--include-prod explicitly allows stopping cross-directory project containers", () => {
  const result = exercise({
    crossDirFor: "dev",
    mockWorkingDir: "/srv/wangsh-releases/2.2.10/source",
    allowCrossDir: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 2);
});

test("same-directory project containers are stopped without extra confirmation", () => {
  const result = exercise({ sameDir: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 2);
});

test("uses the canonical production project name when Compose and .env define one", () => {
  const result = exercise({
    crossDirFor: "prod",
    prodProjectName: "wangsh",
    mockWorkingDir: "/srv/wangsh-releases/2.2.10/source",
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.calls.length, 0, result.calls.join("\n"));
});

test("docker ps failure refuses to stop instead of assuming no cross-directory containers", () => {
  const result = exercise({
    crossDirFor: "dev",
    mockWorkingDir: "/srv/wangsh-releases/2.2.10/source",
    psFail: true,
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.calls.length, 0, result.calls.join("\n"));
  assert.match(result.stderr, /无法查询 Docker 项目/);
});

test("--include-prod is wired into argument parsing and the guard", () => {
  assert.match(source, /--include-prod\)/);
  assert.match(source, /ALLOW_CROSS_DIR_STOP=true/);
  assert.match(source, /ALLOW_CROSS_DIR_STOP:-false/);
  assert.match(source, /--include-prod 仅与 --all 一起生效/);
});
