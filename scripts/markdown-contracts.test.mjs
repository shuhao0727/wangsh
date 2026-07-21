import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function writeFixtureFile(root, relativePath, content) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function runFixture(candidate, summaryLines, setup) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wangsh-markdown-contracts-"));
  const fixtureRoot = path.join(tempRoot, "repo");
  fs.mkdirSync(fixtureRoot);

  writeFixtureFile(
    fixtureRoot,
    "README.md",
    "# Fixture\n\n[Candidate](docs/docker/plans/candidate.md)\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/features/LEARNING.md",
    [
      "# Learning",
      "",
      "- `ml/chapters/`（1 个）",
      "- `ai/chapters/`（1 个）",
      "- `agents/chapters/`（1 个）",
      "",
    ].join("\n"),
  );
  for (const moduleName of ["ml", "ai", "agents"]) {
    writeFixtureFile(
      fixtureRoot,
      `frontend/src/pages/Admin/ITTechnology/${moduleName}/chapters/one.md`,
      `# ${moduleName}\n`,
    );
  }
  writeFixtureFile(
    fixtureRoot,
    "docs/features/ASSESSMENT.md",
    [
      "# Assessment",
      "",
      "> 状态：active",
      "> Owner：assessment",
      "",
      "[hot](assessment/hot_agent.md)",
      "[chain](assessment/chain_agent.md)",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/features/assessment/hot_agent.md",
    "# Hot Agent\n",
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/features/assessment/chain_agent.md",
    "# Chain Agent\n",
  );
  const summary = summaryLines.join("\n");
  writeFixtureFile(
    fixtureRoot,
    "docs/docker/testing/TEST_STATUS.md",
    `# Test status\n\n> 状态：active\n> Owner：testing\n\n${summary}\n`,
  );
  writeFixtureFile(
    fixtureRoot,
    "docs/docker/archive/README.md",
    "# Archive\n\n> 状态：active\n> Owner：docs\n",
  );
  writeFixtureFile(fixtureRoot, "docs/docker/plans/candidate.md", candidate);

  writeFixtureFile(
    fixtureRoot,
    "scripts/check-markdown-contracts.mjs",
    fs.readFileSync(path.join(repoRoot, "scripts/check-markdown-contracts.mjs"), "utf8"),
  );
  setup?.(fixtureRoot);

  const git = spawnSync("git", ["init", "-q"], { cwd: fixtureRoot, encoding: "utf8" });
  assert.equal(git.status, 0, git.stderr);

  const result = spawnSync(process.execPath, ["scripts/check-markdown-contracts.mjs"], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
  fs.rmSync(tempRoot, { recursive: true, force: true });
  return result;
}

test("repository Markdown contracts pass", () => {
  const result = spawnSync(process.execPath, ["scripts/check-markdown-contracts.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`.trim());
  assert.match(result.stdout, /Markdown contracts passed/);
});

test("rejects absolute links that escape the repository", () => {
  const result = runFixture(
    "# Candidate\n\n> 状态：active\n> Owner：docs\n\n[outside](/etc/passwd)\n",
    ["11 files / 4 links / 0 missing"],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside repository/);
});

test("rejects symlink links that escape the repository", () => {
  const result = runFixture(
    "# Candidate\n\n> 状态：active\n> Owner：docs\n\n[outside](passwd-link)\n",
    ["11 files / 4 links / 0 missing"],
    (fixtureRoot) => {
      fs.symlinkSync("/etc/passwd", path.join(fixtureRoot, "docs/docker/plans/passwd-link"));
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside repository/);
});

test("requires lifecycle metadata in the document preamble", () => {
  const result = runFixture(
    "# Candidate\n\n```yaml\nstatus: active\nowner: docs\n```\n",
    ["11 files / 3 links / 0 missing"],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing lifecycle status/);
  assert.match(result.stderr, /missing owner/);
});

test("applies redirect rules to YAML frontmatter", () => {
  const result = runFixture(
    "---\nstatus: redirect\nowner: docs\n---\n\n# Candidate\n\nNo target.\n",
    ["11 files / 3 links / 0 missing"],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /redirect has no target link/);
});

test("requires the exact derived Markdown summary", () => {
  const result = runFixture(
    "# Candidate\n\n> 状态：active\n> Owner：docs\n",
    ["files: 11", "links: 3"],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stale Markdown summary/);
});

test("checks reference-style links", () => {
  const result = runFixture(
    [
      "# Candidate",
      "",
      "> 状态：active",
      "> Owner：docs",
      "",
      "[outside][passwd]",
      "",
      "[passwd]: /etc/passwd",
      "",
    ].join("\n"),
    ["11 files / 3 links / 0 missing", "11 files / 4 links / 0 missing"],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside repository/);
});

test("ignores links in tilde-fenced and inline code", () => {
  const result = runFixture(
    [
      "# Candidate",
      "",
      "> 状态：active",
      "> Owner：docs",
      "",
      "~~~markdown",
      "[fenced](/definitely-missing-fenced)",
      "~~~",
      "",
      "`[inline](/definitely-missing-inline)`",
      "",
    ].join("\n"),
    ["11 files / 3 links / 0 missing", "11 files / 5 links / 0 missing"],
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`.trim());
});

test("rejects an unbalanced tilde fence", () => {
  const result = runFixture(
    [
      "# Candidate",
      "",
      "> 状态：active",
      "> Owner：docs",
      "",
      "~~~markdown",
      "never closed",
      "",
    ].join("\n"),
    ["11 files / 3 links / 0 missing"],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unbalanced fenced code blocks/);
});

test("Markdown-only changes trigger the Markdown quality workflow", () => {
  const workflowPath = path.join(repoRoot, ".github/workflows/markdown-quality.yml");
  assert.equal(fs.existsSync(workflowPath), true, "markdown-quality workflow is missing");

  const workflow = fs.readFileSync(workflowPath, "utf8");
  assert.match(workflow, /pull_request:[\s\S]*paths:[\s\S]*"\*\*\/\*\.md"/);
  assert.match(workflow, /push:[\s\S]*branches:[\s\S]*main/);
  assert.match(workflow, /scripts\/check-markdown-contracts\.mjs/);
  assert.match(workflow, /scripts\/markdown-contracts\.test\.mjs/);
  assert.match(workflow, /\.github\/workflows\/markdown-quality\.yml/);
  assert.match(workflow, /permissions:[\s\S]*contents:\s*read/);
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /actions\/setup-node@v4[\s\S]*node-version:\s*"20"/);
  assert.match(workflow, /node --test scripts\/markdown-contracts\.test\.mjs/);
});
