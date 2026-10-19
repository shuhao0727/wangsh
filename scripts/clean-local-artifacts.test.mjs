import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = fileURLToPath(new URL("./clean-local-artifacts.sh", import.meta.url));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wangsh-clean-contract-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(source, path.join(root, "scripts/clean-local-artifacts.sh"));
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  git("init", "--quiet");
  fs.writeFileSync(path.join(root, ".gitignore"), "__pycache__/\n.pytest_cache/\n.ruff_cache/\n.coverage\n.playwright-cli/\n");
  const add = (relative) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "fixture\n");
    return target;
  };
  const run = (...args) => {
    const result = spawnSync("bash", ["scripts/clean-local-artifacts.sh", ...args], {
      cwd: root, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  return { root, git, add, run };
}

test("preview preserves files; apply only clears ignored source caches", (t) => {
  const f = fixture(t);
  const cache = f.add("backend/app/services/__pycache__/compiled.pyc");
  const coverage = f.add("backend/.coverage");
  const tracked = f.add("backend/tests/__pycache__/tracked.txt");
  f.git("add", "-f", "backend/tests/__pycache__/tracked.txt");
  const regular = f.add("backend/app/services/module.py");
  assert.match(f.run(), /将删除/);
  assert.ok(fs.existsSync(cache));
  assert.ok(fs.existsSync(coverage));
  f.run("--apply");
  assert.ok(!fs.existsSync(cache));
  assert.ok(!fs.existsSync(coverage));
  assert.ok(fs.existsSync(tracked));
  assert.ok(fs.existsSync(regular));
});

test("never descends into worktrees, runtime data, dependencies or evidence", (t) => {
  const f = fixture(t);
  const protectedPaths = [
    ".claude/worktrees/other/backend/app/__pycache__/keep.pyc",
    ".codex/evidence/__pycache__/keep.pyc",
    "data/__pycache__/keep.pyc",
    "backend/venv/lib/__pycache__/keep.pyc",
    "backend/app/data/__pycache__/keep.pyc",
    "backend/app/uploads/__pycache__/keep.pyc",
    "backend/app/.venv/__pycache__/keep.pyc",
    "backend/app/node_modules/pkg/__pycache__/keep.pyc",
    "frontend/build/__pycache__/keep.pyc",
    ".playwright-cli/approved.png",
  ].map(f.add);
  f.run("--apply");
  for (const target of protectedPaths) assert.ok(fs.existsSync(target), target);
  f.run("--apply", "--include-browser-artifacts");
  assert.ok(!fs.existsSync(protectedPaths.at(-1)));
  for (const target of protectedPaths.slice(0, -1)) assert.ok(fs.existsSync(target), target);
});

test("does not follow symbolic links or delete unignored browser artifacts", (t) => {
  const f = fixture(t);
  const keep = f.add("outside/__pycache__/keep.pyc");
  fs.mkdirSync(path.join(f.root, "backend"));
  fs.symlinkSync(path.join(f.root, "outside"), path.join(f.root, "backend/app"), "dir");
  const unignored = f.add(".playwright-mcp/session.yaml");
  f.run("--apply", "--include-browser-artifacts");
  assert.ok(fs.existsSync(keep));
  assert.ok(fs.existsSync(unignored));
});
