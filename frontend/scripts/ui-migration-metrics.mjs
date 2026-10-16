#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(full);
  }
  return out;
}

const files = walk(srcDir);

const metrics = {
  tsx_ts_files: files.length,
  antd_import_files: 0,
  ant_design_icons_import_files: 0,
  message_calls: 0,
  show_message_calls: 0,
};

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (/from\s*["']antd(?:["']|\/)/.test(text)) {
    metrics.antd_import_files += 1;
  }
  if (/from\s*["']@ant-design\/icons["']/.test(text)) {
    metrics.ant_design_icons_import_files += 1;
  }

  const messageCalls = text.match(/\bmessage\.(success|error|warning|info|loading|destroy)\(/g);
  if (messageCalls) metrics.message_calls += messageCalls.length;

  const showMessageCalls = text.match(/\bshowMessage\.(success|error|warning|info|loading|destroy)\(/g);
  if (showMessageCalls) metrics.show_message_calls += showMessageCalls.length;
}

const output = {
  generated_at: new Date().toISOString(),
  cwd: root,
  metrics,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

console.log("UI Migration Metrics");
console.log("===================");
console.log(`generated_at: ${output.generated_at}`);
console.log(`ts/tsx files: ${metrics.tsx_ts_files}`);
console.log(`antd import files: ${metrics.antd_import_files}`);
console.log(`@ant-design/icons import files: ${metrics.ant_design_icons_import_files}`);
console.log(`message.* calls: ${metrics.message_calls}`);
console.log(`showMessage.* calls: ${metrics.show_message_calls}`);
