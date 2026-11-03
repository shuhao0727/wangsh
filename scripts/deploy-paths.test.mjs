import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

function fixture(run) {
  const root = mkdtempSync(path.join(tmpdir(), "wangsh-deploy-paths-"));
  const repo = path.join(root, "repo");
  const caller = path.join(root, "caller");
  const bin = path.join(root, "bin");
  mkdirSync(path.join(repo, "scripts"), { recursive: true });
  mkdirSync(caller);
  mkdirSync(bin);
  for (const name of ["deploy.sh", "rollback.sh"]) {
    writeFileSync(path.join(repo, "scripts", name), read(name));
  }
  writeFileSync(path.join(repo, ".env"), "POSTGRES_DB=decoy\n");
  writeFileSync(path.join(repo, "docker-compose.yml"), "services: {}\n");
  writeFileSync(path.join(caller, "ops.env"), "POSTGRES_DB=expected\n");
  writeFileSync(path.join(caller, "compose.yml"), "services: {}\n");
  const trace = path.join(root, "trace");
  const docker = path.join(bin, "docker");
  writeFileSync(docker, `#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
with open(os.environ['MOCK_TRACE'], 'a') as out:
    out.write(json.dumps(args) + '\\n')
if args == ['info']:
    sys.exit(0)
if args and args[0] == 'run' and 'history' in args:
    print('target_revision')
    sys.exit(0)
if not args or args[0] != 'compose':
    sys.exit(97)
env = args[args.index('--env-file') + 1]
compose = args[args.index('-f') + 1]
if pathlib.Path(env).resolve() != pathlib.Path(os.environ['EXPECTED_ENV']).resolve():
    sys.exit(98)
if pathlib.Path(compose).resolve() != pathlib.Path(os.environ['EXPECTED_COMPOSE']).resolve():
    sys.exit(99)
if pathlib.Path(os.environ.get('PWD', '')).resolve() != pathlib.Path(compose).resolve().parent:
    sys.exit(95)
if 'config' in args and '--environment' in args:
    print('POSTGRES_DB=expected\\nPOSTGRES_USER=synthetic')
elif 'config' in args and '--images' in args:
    print('synthetic/wangsh-backend:2.2.4')
elif 'ps' in args and '--format' in args:
    print('postgres')
elif 'ps' in args and '--services' in args:
    print('backend')
elif 'history' in args:
    print('target_revision')
elif 'pg_dump' in args:
    sys.stdout.buffer.write(b'PGDMP synthetic archive')
elif 'pg_restore' in args and '--list' in args:
    sys.stdin.buffer.read()
    print('synthetic readable archive')
elif 'stop' in args or 'start' in args or 'downgrade' in args:
    pass
else:
    sys.exit(96)
`);
  chmodSync(docker, 0o755);
  const env = {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: root,
    MOCK_TRACE: trace,
    EXPECTED_ENV: path.join(caller, "ops.env"),
    EXPECTED_COMPOSE: path.join(caller, "compose.yml"),
    ENV_FILE: "ops.env",
    COMPOSE_FILE: "compose.yml",
    BACKUP_DIR: "relative backups",
  };
  try { run({ root, repo, caller, trace, env }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test("rollback and the real backup child keep caller-relative targets", () => fixture(({ repo, caller, trace, env }) => {
  const result = spawnSync("bash", [path.join(repo, "scripts/rollback.sh"), "rollback", "target_revision"], {
    cwd: caller, env, input: "yes\n", encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const calls = readFileSync(trace, "utf8").trim().split("\n").map(JSON.parse);
  assert.ok(calls.some((args) => args.includes("pg_dump")));
  assert.ok(calls.some((args) => args.includes("downgrade")));
  assert.match(result.stdout, /relative backups/);
  const backupDir = path.join(caller, "relative backups");
  assert.ok(readFileSync(path.join(backupDir, result.stdout.split("\n").find((line) => line.endsWith(".dump")).split("/").at(-1))).length);
}));

test("explicit relative deployment paths retain their original anchor", () => fixture(({ repo, caller, env }) => {
  const script = read("deploy.sh");
  const prefix = script.slice(0, script.indexOf("\nrelease_image_names=("));
  const probe = path.join(repo, "scripts/probe.sh");
  writeFileSync(probe, `${prefix}\nprintf '%s\\n' "$env_file" "$compose_file" "$release_set_default" "$BACKUP_DIR"\n`);
  const result = spawnSync("bash", [probe, "probe", "candidate.release"], {
    cwd: caller, env: { ...env, RELEASE_SET_FILE: "candidate.release" }, encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), ["ops.env", "compose.yml", "candidate.release", "relative backups"].map((p) => path.join(realpathSync(caller), p)));
}));

test("restore never substitutes a repository file for a missing caller-relative dump", () => fixture(({ repo, caller, env }) => {
  writeFileSync(path.join(repo, "missing.dump"), "PGDMP decoy");
  const result = spawnSync("bash", [path.join(repo, "scripts/deploy.sh"), "restore-db", "missing.dump", "--yes"], { cwd: caller, env, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage:.*restore-db/);
}));
