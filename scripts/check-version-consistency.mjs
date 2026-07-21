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

const expected = JSON.parse(read("frontend/package.json")).version;
const composeImageTagDefaults = [
  ...read("docker-compose.yml").matchAll(/\$\{IMAGE_TAG:-([^}]+)\}/g),
].map((match) => match[1]);
const composeImageTagValue =
  composeImageTagDefaults.length > 0
  && composeImageTagDefaults.every((value) => value === expected)
    ? expected
    : composeImageTagDefaults.join(",") || undefined;
const dockerhubDefault = read(".github/workflows/dockerhub-amd64.yml")
  .match(/image_tag:[\s\S]*?default:\s*["']?([^"'\s]+)["']?/)?.[1];
const simulationDefault = read("scripts/deploy.sh")
  .match(/SIM_VERSION:-([^}]+)\}/)?.[1];
const checks = [
  ["frontend/package-lock.json", JSON.parse(read("frontend/package-lock.json")).version],
  [".env.example APP_VERSION", readEnv(".env.example").get("APP_VERSION")],
  [".env.example IMAGE_TAG", readEnv(".env.example").get("IMAGE_TAG")],
  [".env.example REACT_APP_VERSION", readEnv(".env.example").get("REACT_APP_VERSION")],
  ["docker-compose.yml IMAGE_TAG default", composeImageTagValue],
  [".github/workflows/dockerhub-amd64.yml image_tag default", dockerhubDefault],
  ["scripts/deploy.sh SIM_VERSION default", simulationDefault],
];

const failures = checks.filter(([, value]) => value !== expected);

if (failures.length > 0) {
  console.error(`Version consistency check failed. Expected ${expected}.`);
  for (const [label, value] of failures) {
    console.error(`- ${label}: ${value || "<missing>"}`);
  }
  process.exit(1);
}

console.log(`Version consistency check passed: ${expected}`);
