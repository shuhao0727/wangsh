import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const source = readFileSync(new URL("../start-dev.sh", import.meta.url), "utf8");
const setDefault = source.slice(source.indexOf("set_default_env() {"), source.indexOf("# 函数：判断后端"));
const alias = source.slice(source.indexOf("is_docker_local_host_alias() {"), source.indexOf("spawn_detached_process() {"));
const load = source.slice(source.indexOf("load_env_file() {"), source.indexOf("# 函数：检查命令"));
const setup = source.slice(source.indexOf("setup_environment() {"), source.indexOf("dev_compose() {"));
const required = "POSTGRES_USER=synthetic\nPOSTGRES_PASSWORD=synthetic-pg\nPOSTGRES_DB=synthetic\nSECRET_KEY=synthetic-key\nSUPER_ADMIN_USERNAME=synthetic\nSUPER_ADMIN_PASSWORD=synthetic-admin\nAGENT_API_KEY_ENCRYPTION_KEY=synthetic-fernet\nCORS_ORIGINS=[]\n";

function run(extra = "", { local = "", dev = true, prod = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "wangsh-dev-config-"));
  mkdirSync(path.join(dir, "backend"));
  if (dev) writeFileSync(path.join(dir, ".env.dev"), required + extra);
  if (prod) writeFileSync(path.join(dir, ".env"), required);
  if (local) writeFileSync(path.join(dir, ".env.local"), local);
  const code = `set -euo pipefail
PROJECT_ROOT="$FIXTURE_ROOT"
BACKEND_DIR="$PROJECT_ROOT/backend"
START_MODE=local
BACKEND_PORT=8000 FRONTEND_PORT=6608
print_info() { :; }; print_warning() { :; }; print_success() { :; }; print_error() { printf '%s\\n' "$1" >&2; }
node() { printf 'CHECK:%s\\n' "$*"; }
mkdir() { printf 'MKDIR:%s\\n' "$*"; }
${setDefault}
${alias}
${load}
${setup}
setup_environment
printf 'RESULT:%s|%s|%s|%s\\n' "$POSTGRES_PORT" "$REACT_APP_ENV" "$UPLOAD_FOLDER" "$TYPST_PDF_STORAGE_DIR"
`;
  try {
    return { ...spawnSync("bash", ["-c", code], { env: { PATH: "/usr/bin:/bin", FIXTURE_ROOT: realpathSync(dir) }, encoding: "utf8" }), root: realpathSync(dir) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("development defaults use the published database and shared upload storage", () => {
  const out = run();
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /RESULT:5433\|development\|.*data\/dev\/uploads\|.*data\/dev\/typst_pdfs/);
  assert.match(out.stdout, /CHECK:.*--startup local/);
  assert.ok(out.stdout.indexOf("CHECK:") < out.stdout.indexOf("MKDIR:"));
});

test("explicit upload directories are preserved rather than moved", () => {
  const out = run("UPLOAD_FOLDER=/synthetic/custom-uploads\n");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /\|\/synthetic\/custom-uploads\|/);
});

test("empty upload overrides fail before filesystem setup", () => {
  const out = run("UPLOAD_FOLDER=\n");
  assert.notEqual(out.status, 0);
  assert.doesNotMatch(out.stdout, /MKDIR:/);
});

test("missing development configuration cannot fall back to production", () => {
  const out = run("", { dev: false, prod: true });
  assert.notEqual(out.status, 0);
  assert.doesNotMatch(out.stdout, /CHECK:|MKDIR:/);
});

test("personal overrides are validated after both files are loaded", () => {
  const result = run("", { local: "SECRET_KEY=\n" });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /CHECK:|MKDIR:/);
});

test("actual Compose invocation uses the same explicit files and discards inherited selectors", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "wangsh-compose-wrapper-"));
  try {
    writeFileSync(path.join(dir, ".env.local"), "# synthetic\n");
    const start = source.indexOf("dev_compose() {");
    const code = source.slice(start, source.indexOf("check_development_containers() {", start));
    const out = spawnSync("bash", ["-c", `set -euo pipefail
PROJECT_ROOT="$FIXTURE_ROOT"
COMPOSE_FILE=/synthetic/foreign.yml COMPOSE_PROJECT_NAME=foreign COMPOSE_ENV_FILES=foreign.env
export COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_ENV_FILES
# env is mocked; no real Docker operation can run.
env() { printf 'WRAPPER:%s\\n' "$*"; }
${code}
dev_compose config --quiet
`], { env: { PATH: "/usr/bin:/bin", FIXTURE_ROOT: dir }, encoding: "utf8" });
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /-u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_ENV_FILES/);
    assert.ok(out.stdout.includes(`--env-file ${dir}/.env.dev --env-file ${dir}/.env.local -f ${dir}/docker-compose.dev.yml config --quiet`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the development template avoids production address and frontend defaults", () => {
  const template = readFileSync(new URL("../.env.dev.example", import.meta.url), "utf8");
  assert.match(template, /^POSTGRES_HOST=127\.0\.0\.1$/m);
  assert.match(template, /^POSTGRES_PORT=5433$/m);
  assert.match(template, /^REACT_APP_ENV=development$/m);
  assert.match(template, /^SECRET_KEY=$/m);
  assert.doesNotMatch(template, /^UPLOAD_FOLDER=\.\/uploads/m);
});
