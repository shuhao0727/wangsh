import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const realRepoRoot = fs.realpathSync(repoRoot);

function listMarkdownFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "--", "*.md"],
    { cwd: repoRoot, encoding: "utf8" },
  );

  return [...new Set(output.split("\n").filter(Boolean))].sort();
}

function stripInlineCode(line) {
  return line.replace(/(`+)([^`]*?)\1/g, "");
}

function stripCode(text) {
  const output = [];
  let fence = null;

  for (const line of text.split(/\r?\n/)) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (!fence && marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      output.push("");
      continue;
    }

    if (fence) {
      const closing = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
      if (
        closing &&
        closing[1][0] === fence.character &&
        closing[1].length >= fence.length
      ) {
        fence = null;
      }
      output.push("");
      continue;
    }

    output.push(stripInlineCode(line));
  }

  return output.join("\n");
}

function hasUnbalancedFence(text) {
  let fence = null;

  for (const line of text.split(/\r?\n/)) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (!fence && marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      continue;
    }

    if (!fence) continue;
    const closing = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
    if (
      closing &&
      closing[1][0] === fence.character &&
      closing[1].length >= fence.length
    ) {
      fence = null;
    }
  }

  return fence !== null;
}

function headingSlugs(text) {
  const counts = new Map();
  const slugs = new Set();

  for (const match of stripCode(text).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = match[1]
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_~]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s+/g, "-");
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }

  return slugs;
}

function normalizeReference(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseDestination(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    return end === -1 ? "" : trimmed.slice(1, end);
  }

  let escaped = false;
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (/\s/.test(character)) return trimmed.slice(0, index);
  }
  return trimmed;
}

function matchingDelimiter(text, start, open, close) {
  let depth = 0;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === open) depth += 1;
    if (character === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function localMarkdownLinks(file, text) {
  const codeFree = stripCode(text);
  const links = [];
  const references = new Map();
  const withoutDefinitions = codeFree.replace(
    /^[ \t]{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*$/gm,
    (_line, label, destination) => {
      references.set(normalizeReference(label), parseDestination(destination));
      return "";
    },
  );

  for (let index = 0; index < withoutDefinitions.length; index += 1) {
    if (withoutDefinitions[index] !== "[") continue;

    const labelEnd = matchingDelimiter(withoutDefinitions, index, "[", "]");
    if (labelEnd === -1) continue;
    const label = withoutDefinitions.slice(index + 1, labelEnd);
    const next = withoutDefinitions[labelEnd + 1];

    if (next === "(") {
      const destinationEnd = matchingDelimiter(withoutDefinitions, labelEnd + 1, "(", ")");
      if (destinationEnd === -1) continue;
      const raw = parseDestination(
        withoutDefinitions.slice(labelEnd + 2, destinationEnd),
      ).replace(/\\([\\() ])/g, "$1");
      if (raw) links.push(raw);
      index = destinationEnd;
      continue;
    }

    if (next === "[") {
      const referenceEnd = matchingDelimiter(withoutDefinitions, labelEnd + 1, "[", "]");
      if (referenceEnd === -1) continue;
      const reference = withoutDefinitions.slice(labelEnd + 2, referenceEnd) || label;
      const raw = references.get(normalizeReference(reference));
      if (raw) links.push(raw);
      index = referenceEnd;
      continue;
    }

    const raw = references.get(normalizeReference(label));
    if (raw) links.push(raw);
  }

  return links;
}

function documentMetadata(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const metadata = new Map();
  let index = 0;

  while (index < lines.length && !lines[index].trim()) index += 1;
  if (lines[index]?.trim() === "---") {
    index += 1;
    while (index < lines.length && lines[index].trim() !== "---") {
      const match = lines[index].match(/^([A-Za-z\u4e00-\u9fff_]+)\s*:\s*(.+?)\s*$/);
      if (match) metadata.set(match[1].toLowerCase(), match[2].trim());
      index += 1;
    }
    if (lines[index]?.trim() === "---") index += 1;
  }

  while (index < lines.length && !lines[index].trim()) index += 1;
  if (/^#\s+/.test(lines[index] || "")) index += 1;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (!line.startsWith(">")) break;

    const match = line.match(/^>\s*([A-Za-z\u4e00-\u9fff_]+)\s*[：:]\s*(.+?)\s*$/);
    if (match) metadata.set(match[1].toLowerCase(), match[2].trim());
    index += 1;
  }

  return metadata;
}

function metadataValue(metadata, ...keys) {
  for (const key of keys) {
    const value = metadata.get(key.toLowerCase());
    if (value) return value;
  }
  return "";
}

function withinRepository(target) {
  return target === realRepoRoot || target.startsWith(`${realRepoRoot}${path.sep}`);
}

function audit() {
  const files = listMarkdownFiles();
  const errors = [];
  let relativeLinks = 0;

  for (const file of files) {
    const absolute = path.resolve(repoRoot, file);
    const text = fs.readFileSync(absolute, "utf8");
    if (hasUnbalancedFence(text)) errors.push(`${file}: unbalanced fenced code blocks`);

    const h1Count = (stripCode(text).match(/^# /gm) || []).length;
    if (h1Count > 1) errors.push(`${file}: multiple H1 headings`);

    for (const raw of localMarkdownLinks(file, text)) {
      relativeLinks += 1;
      const [encodedTarget, encodedAnchor] = raw.split("#", 2);
      let target;
      let anchor;
      try {
        target = decodeURIComponent((encodedTarget || "").split("?")[0]);
        anchor = encodedAnchor ? decodeURIComponent(encodedAnchor).toLowerCase() : "";
      } catch {
        errors.push(`${file}: malformed link encoding ${raw}`);
        continue;
      }
      if (!target && !anchor) continue;
      if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//")) continue;
      if (path.isAbsolute(target)) {
        errors.push(`${file}: link target is outside repository ${raw}`);
        continue;
      }

      const resolved = target ? path.resolve(path.dirname(absolute), target) : absolute;

      if (!fs.existsSync(resolved)) {
        errors.push(`${file}: missing link target ${raw}`);
        continue;
      }

      const realResolved = fs.realpathSync(resolved);
      if (!withinRepository(realResolved)) {
        errors.push(`${file}: link target is outside repository ${raw}`);
        continue;
      }

      if (anchor && fs.statSync(realResolved).isFile() && realResolved.endsWith(".md")) {
        const targetText = fs.readFileSync(resolved, "utf8");
        if (!headingSlugs(targetText).has(anchor)) {
          errors.push(`${file}: missing heading anchor ${raw}`);
        }
      }
    }
  }

  const governedPrefixes = [
    "docs/docker/plans/",
    "docs/docker/testing/",
    "docs/docker/frontend/",
    "docs/docker/archive/",
  ];

  for (const file of files.filter((item) => governedPrefixes.some((prefix) => item.startsWith(prefix)))) {
    const text = fs.readFileSync(path.resolve(repoRoot, file), "utf8");
    const metadata = documentMetadata(text);
    const status = metadataValue(metadata, "状态", "status").toLowerCase();
    if (!status) {
      errors.push(`${file}: missing lifecycle status`);
    }
    if (!metadataValue(metadata, "owner")) {
      errors.push(`${file}: missing owner`);
    }

    if (status === "redirect") {
      if (text.split(/\r?\n/).length > 25) errors.push(`${file}: redirect is too long`);
      if (!localMarkdownLinks(file, text).length) errors.push(`${file}: redirect has no target link`);
    }
  }

  const archiveFiles = files
    .filter((file) => file.startsWith("docs/docker/archive/") && file !== "docs/docker/archive/README.md")
    .map((file) => path.resolve(repoRoot, file));
  const archiveIndex = fs.readFileSync(path.resolve(repoRoot, "docs/docker/archive/README.md"), "utf8");
  const indexedArchiveFiles = new Set(
    localMarkdownLinks("docs/docker/archive/README.md", archiveIndex)
      .map((raw) => decodeURIComponent(raw.split("#")[0]))
      .filter(Boolean)
      .map((target) => path.resolve(repoRoot, "docs/docker/archive", target)),
  );

  for (const archived of archiveFiles) {
    if (!indexedArchiveFiles.has(archived)) {
      errors.push(`${path.relative(repoRoot, archived)}: missing from archive index`);
    }
  }

  const learning = fs.readFileSync(path.resolve(repoRoot, "docs/features/LEARNING.md"), "utf8");
  for (const moduleName of ["ml", "ai", "agents"]) {
    const chapterDir = path.resolve(
      repoRoot,
      `frontend/src/pages/Admin/ITTechnology/${moduleName}/chapters`,
    );
    const count = fs.readdirSync(chapterDir).filter((name) => name.endsWith(".md")).length;
    const linePattern = new RegExp(`${moduleName}/chapters/\`[^\\n]*（${count} 个）`);
    if (!linePattern.test(learning)) {
      errors.push(`docs/features/LEARNING.md: stale ${moduleName} chapter count, expected ${count}`);
    }
  }

  const summary = `${files.length} files / ${relativeLinks} links / 0 missing`;
  for (const file of [
    "docs/docker/testing/TEST_STATUS.md",
    "docs/docker/plans/2026-07-12-project-consolidation-and-release-plan.md",
  ]) {
    const text = fs.readFileSync(path.resolve(repoRoot, file), "utf8");
    if (!text.includes(summary)) {
      errors.push(`${file}: stale Markdown summary, expected ${summary}`);
    }
  }

  for (const generated of [
    "backend/.pytest_cache/README.md",
    "test-results/prod-smoke/failures.md",
  ]) {
    if (fs.existsSync(path.resolve(repoRoot, generated))) {
      errors.push(`${generated}: generated Markdown should not remain in the workspace`);
    }
  }

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }

  console.log(`Markdown contracts passed: ${summary}`);
}

audit();
