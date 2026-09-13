#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.env.VERSION_CHECK_ROOT
  ? resolve(process.env.VERSION_CHECK_ROOT)
  : resolve(import.meta.dirname, "..");

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

// 发布合同：package.json 的 version 是完整版本号（如 2.0.0），
// 镜像标签使用 major.minor（如 2.0）。两者必须同源一致。
const expectedVersion = JSON.parse(read("frontend/package.json")).version;
const versionParts = expectedVersion.split(".");
const expectedImageTag =
  versionParts.length >= 2 ? `${versionParts[0]}.${versionParts[1]}` : expectedVersion;

// CI 需要按同一派生规则校验 compose 实际渲染出的镜像标签（只有 docker 能取到），
// 因此暴露只打印标签的模式，避免调用方各自推导出不同口径。
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

const versionChecks = [
  ["frontend/package-lock.json", JSON.parse(read("frontend/package-lock.json")).version],
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
