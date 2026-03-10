const fs = require("fs");
const path = require("path");

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

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const pkgRoot = path.join(projectRoot, "node_modules", "pyodide");
  if (!fs.existsSync(pkgRoot)) {
    console.error("pyodide package not found at", pkgRoot);
    process.exit(1);
  }

  const src = pkgRoot;
  const dst = path.join(projectRoot, "public", "pyodide");

  ensureDir(dst);
  copyDir(src, dst);

  const mainJs = path.join(dst, "pyodide.js");
  if (!fs.existsSync(mainJs)) {
    console.error("pyodide.js not found after copy at", mainJs);
    process.exit(1);
  }
}

main();
