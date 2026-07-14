const fs = require("fs");
const path = require("path");

const REQUIRED_RUNTIME_FILES = [
  "pyodide.js",
  "pyodide.mjs",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];
const VERSION_MARKER = ".wangsh-pyodide-version";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

function isCopyableFile(name) {
  return (
    name.endsWith(".js") ||
    name.endsWith(".mjs") ||
    name.endsWith(".wasm") ||
    name.endsWith(".data") ||
    name.endsWith(".zip") ||
    name.endsWith(".json") ||
    name.endsWith(".txt") ||
    name.endsWith(".map")
  );
}

function copyDir(srcDir, dstDir) {
  ensureDir(dstDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const ent of entries) {
    const src = path.join(srcDir, ent.name);
    const dst = path.join(dstDir, ent.name);
    if (ent.isDirectory()) {
      copyDir(src, dst);
      continue;
    }
    if (ent.isFile() && isCopyableFile(ent.name)) {
      copyFile(src, dst);
    }
  }
}

function hasCompleteRuntime(directory, expectedVersion) {
  const filesComplete = REQUIRED_RUNTIME_FILES.every((file) => {
    const filePath = path.join(directory, file);
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  });
  if (!filesComplete || !expectedVersion) {
    return filesComplete;
  }

  const markerPath = path.join(directory, VERSION_MARKER);
  return (
    fs.existsSync(markerPath) &&
    fs.readFileSync(markerPath, "utf8").trim() === expectedVersion
  );
}

function replaceRuntime(tempDst, dst, operations = fs) {
  const backupDst = `${dst}.backup-${process.pid}`;
  operations.rmSync(backupDst, { recursive: true, force: true });
  const hadPreviousRuntime = operations.existsSync(dst);

  if (hadPreviousRuntime) {
    operations.renameSync(dst, backupDst);
  }

  try {
    operations.renameSync(tempDst, dst);
  } catch (error) {
    if (hadPreviousRuntime) {
      operations.rmSync(dst, { recursive: true, force: true });
      operations.renameSync(backupDst, dst);
    }
    throw error;
  }

  operations.rmSync(backupDst, { recursive: true, force: true });
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const pkgRoot = path.join(projectRoot, "node_modules", "pyodide");
  if (!fs.existsSync(pkgRoot)) {
    console.error("pyodide package not found at", pkgRoot);
    process.exit(1);
  }

  const src = pkgRoot;
  const dst = path.join(projectRoot, "public", "pyodide");
  const packageVersion = JSON.parse(
    fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"),
  ).version;

  if (hasCompleteRuntime(dst, packageVersion)) {
    console.log("pyodide already copied, skipping...");
    return;
  }

  const tempDst = `${dst}.tmp-${process.pid}`;
  fs.rmSync(tempDst, { recursive: true, force: true });
  try {
    copyDir(src, tempDst);
    fs.writeFileSync(path.join(tempDst, VERSION_MARKER), `${packageVersion}\n`);
    if (!hasCompleteRuntime(tempDst, packageVersion)) {
      throw new Error(`pyodide runtime is incomplete after copy at ${tempDst}`);
    }
    replaceRuntime(tempDst, dst);
  } catch (error) {
    fs.rmSync(tempDst, { recursive: true, force: true });
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { hasCompleteRuntime, replaceRuntime };
