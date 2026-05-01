#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

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
const checks = [
  ["frontend/package-lock.json", JSON.parse(read("frontend/package-lock.json")).version],
  [".env.example APP_VERSION", readEnv(".env.example").get("APP_VERSION")],
  [".env.example IMAGE_TAG", readEnv(".env.example").get("IMAGE_TAG")],
  [".env.example REACT_APP_VERSION", readEnv(".env.example").get("REACT_APP_VERSION")],
  [".env.dev APP_VERSION", readEnv(".env.dev").get("APP_VERSION")],
  [".env.dev IMAGE_TAG", readEnv(".env.dev").get("IMAGE_TAG")],
  [".env.dev REACT_APP_VERSION", readEnv(".env.dev").get("REACT_APP_VERSION")],
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
