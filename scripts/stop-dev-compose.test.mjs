import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const source = readFileSync(new URL("../stop-dev.sh", import.meta.url), "utf8");
const start = source.indexOf("stop_dev_compose() {");
const end = source.indexOf("# 函数：显示当前状态", start);
assert(start >= 0 && end > start, "stop Compose functions must be extractable without running main");
const functions = source.slice(start, end);

function exercise() {
  const root = mkdtempSync(path.join(tmpdir(), "wangsh-stop-compose-"));
  const trace = path.join(root, "trace");
  writeFileSync(path.join(root, ".env.dev"), "POSTGRES_DB=fixture\n");
  writeFileSync(path.join(root, ".env.local"), "# personal\n");
  writeFileSync(path.join(root, ".env"), "POSTGRES_DB=fixture\n");
  writeFileSync(path.join(root, "docker-compose.dev.yml"), "services: {}\n");
  writeFileSync(path.join(root, "docker-compose.yml"), "services: {}\n");
  const harness = `set -euo pipefail
PROJECT_ROOT="${root}"
MOCK_TRACE="${trace}"
print_info() { :; }
print_warning() { :; }
print_success() { :; }
print_error() { :; }
sleep() { :; }
env() { printf 'ENV %s\\n' "$*" >> "$MOCK_TRACE"; }
docker() {
  case "$*" in
    info*) return 0 ;;
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
    assert.equal(result.status, 0, result.stderr);
    return readFileSync(trace, "utf8").trim().split("\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("stop uses explicit dev/prod files and clears inherited Compose selectors", () => {
  const calls = exercise();
  assert.equal(calls.length, 2, calls.join("\n"));
  assert.match(calls[0], /-u COMPOSE_FILE -u COMPOSE_PROJECT_NAME/);
  assert.match(calls[0], /--env-file .*\.env\.dev --env-file .*\.env\.local -f .*docker-compose\.dev\.yml down --remove-orphans/);
  assert.match(calls[1], /--env-file .*\.env -f .*docker-compose\.yml down --remove-orphans/);
});

test("missing dev env files do not invent paths or break container shutdown", () => {
  const root = mkdtempSync(path.join(tmpdir(), "wangsh-stop-compose-min-"));
  const trace = path.join(root, "trace");
  writeFileSync(path.join(root, "docker-compose.dev.yml"), "services: {}\n");
  writeFileSync(path.join(root, "docker-compose.yml"), "services: {}\n");
  const harness = `set -euo pipefail
PROJECT_ROOT="${root}"
MOCK_TRACE="${trace}"
print_info() { :; }; print_warning() { :; }; print_success() { :; }; print_error() { :; }
sleep() { :; }
env() { printf 'ENV %s\\n' "$*" >> "$MOCK_TRACE"; }
docker() { case "$*" in info*) return 0 ;; ps*) : ;; *) return 99 ;; esac; }
${functions}
stop_docker_containers
`;
  try {
    const result = spawnSync("bash", ["-c", harness], {
      env: { PATH: "/usr/bin:/bin", HOME: root }, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const calls = readFileSync(trace, "utf8").trim().split("\n");
    assert.equal(calls.length, 2);
    assert.doesNotMatch(calls[0], /--env-file/);
    assert.doesNotMatch(calls[1], /--env-file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
