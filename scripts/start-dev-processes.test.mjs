import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

function functions(source, startName, endMarker) {
  const start = source.indexOf(`${startName}() {`);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${startName} extraction boundary`);
  return source.slice(start, end);
}

for (const file of ["start-dev.sh", "stop-dev.sh"]) {
  const source = read(file);
  test(`${file} routes process operations through the shared exact-PID helper`, () => {
    assert.match(source, /dev_processes\(\) \{/);
    assert.match(source, /python3 -I -B .*dev-processes\.py/);
    assert.doesNotMatch(source, /\bpkill\s+-f/);
    assert.doesNotMatch(source, /\bpgrep\s+-f/);
    assert.doesNotMatch(source, /\*\[Pp\]ython\*\)/);
    assert.match(source, /PROJECT_ROOT=.*pwd -P/);
  });
}

test("normal stop status completes when no project processes exist", () => {
  const source = read("stop-dev.sh");
  const status = functions(source, "show_current_status", "# 函数：显示帮助信息");
  const result = spawnSync("bash", ["-c", `set -euo pipefail
RED='' GREEN='' YELLOW='' NC=''
BACKEND_PORT=8000 FRONTEND_PORT=6608 FRONTEND_DIR=/synthetic/frontend
lsof() { return 1; }
pgrep() { return 1; }
docker() { return 1; }
dev_processes() { return 0; }
${status}
show_current_status
printf 'FINISHED\\n'
`], { env: { PATH: "/usr/bin:/bin" }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /FINISHED/);
});

test("process enumeration errors cannot be reported as successful stopping", () => {
  const source = read("stop-dev.sh");
  const stop = functions(source, "stop_all_local_processes", "# 函数：停止Docker容器");
  const result = spawnSync("bash", ["-c", `set -euo pipefail
print_info() { :; }; print_warning() { :; }; print_success() { :; }; print_error() { :; }
dev_processes() { return 1; }
lsof() { return 1; }
pgrep() { return 1; }
pkill() { printf 'UNSAFE_SIGNAL\\n'; return 99; }
BACKEND_PORT=8000 FRONTEND_PORT=6608
${stop}
stop_all_local_processes
`], { env: { PATH: "/usr/bin:/bin" }, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /UNSAFE_SIGNAL/);
});

test("backend dependency checks and Celery use the selected interpreter", () => {
  const source = read("start-dev.sh");
  assert.match(source, /select_backend_python\(\) \{/);
  const backend = functions(source, "start_local_backend", "# 函数：启动本地 Celery");
  const worker = functions(source, "start_local_celery_worker", "# 函数：启动本地前端");
  assert.match(backend, /PYTHON_BIN=.*select_backend_python/);
  assert.match(worker, /PYTHON_BIN=.*select_backend_python/);
  assert.match(worker, /"\$\{PYTHON_BIN\}" -m celery/);
  assert.doesNotMatch(backend, /python3 -c "import uvicorn"/);
});

test("development startup only checks container ownership and never removes by name", () => {
  const source = read("start-dev.sh");
  assert.doesNotMatch(source, /docker rm -f/);
  assert.match(source, /dev-containers\.mjs.*check/);
  const main = functions(source, "main", "# 执行主函数");
  assert.ok(main.indexOf("check_development_containers") < main.indexOf("stop_existing_processes"));
});
