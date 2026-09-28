#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = process.env.VERSION_CHECK_ROOT
  ? resolve(process.env.VERSION_CHECK_ROOT)
  : resolve(scriptDir, "..");

const read = (path) => readFileSync(resolve(root, path), "utf8");

const readEnv = (path) => {
  const values = new Map();
  for (const rawLine of read(path).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    values.set(line.slice(0, index), line.slice(index + 1));
  }
  return values;
};

// 发布合同：package.json 的 version 是完整 SemVer（如 2.1.1）的权威源，
// 应用版本、镜像标签、release-set 与生产默认值必须完全一致。
const expectedVersion = JSON.parse(read("frontend/package.json")).version;
const expectedImageTag = expectedVersion;

// CI 需要按同一派生规则校验 compose 实际渲染出的镜像标签（只有 docker 能取到），
// 因此暴露只打印标签的模式，避免调用方各自推导出不同口径。
if (process.argv.includes("--print-version")) {
  process.stdout.write(expectedVersion);
  process.exit(0);
}
if (process.argv.includes("--print-image-tag")) {
  process.stdout.write(expectedImageTag);
  process.exit(0);
}

const composeImageTagDefaults = [
  ...read("docker-compose.yml").matchAll(/\$\{IMAGE_TAG:-([^}]+)\}/g),
].map((match) => match[1]);
const composeImageTagValue =
  composeImageTagDefaults.length > 0
  && composeImageTagDefaults.every((value) => value === expectedImageTag)
    ? expectedImageTag
    : composeImageTagDefaults.join(",") || undefined;
const dockerhubDefault = read(".github/workflows/dockerhub-amd64.yml")
  .match(/image_tag:[\s\S]*?default:\s*["']?([^"'\s]+)["']?/)?.[1];
const simulationDefault = read("scripts/deploy.sh")
  .match(/SIM_VERSION:-([^}]+)\}/)?.[1];

const packageLock = JSON.parse(read("frontend/package-lock.json"));
const versionChecks = [
  ["frontend/package-lock.json version", packageLock.version],
  ["frontend/package-lock.json root package version", packageLock.packages?.[""]?.version],
  [".env.example APP_VERSION", readEnv(".env.example").get("APP_VERSION")],
  [".env.example REACT_APP_VERSION", readEnv(".env.example").get("REACT_APP_VERSION")],
];
const imageTagChecks = [
  [".env.example IMAGE_TAG", readEnv(".env.example").get("IMAGE_TAG")],
  ["docker-compose.yml IMAGE_TAG default", composeImageTagValue],
  [".github/workflows/dockerhub-amd64.yml image_tag default", dockerhubDefault],
  ["scripts/deploy.sh SIM_VERSION default", simulationDefault],
];

const failures = [
  ...versionChecks.filter(([, value]) => value !== expectedVersion),
  ...imageTagChecks.filter(([, value]) => value !== expectedImageTag),
];

if (failures.length > 0) {
  console.error(
    `Version consistency check failed. Expected version ${expectedVersion} / image tag ${expectedImageTag}.`,
  );
  for (const [label, value] of failures) {
    console.error(`- ${label}: ${value || "<missing>"}`);
  }
  process.exit(1);
}

console.log(
  `Version consistency check passed: version ${expectedVersion} / image tag ${expectedImageTag}`,
);
