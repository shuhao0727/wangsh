#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "@typescript-eslint/parser";

const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".jsx",
  ".json",
  ".mjs",
  ".ts",
  ".tsx",
]);
const TOKEN_DEFINITION_PATTERN = /(--ws-[A-Za-z0-9_-]+)\s*:/g;
const TOKEN_REFERENCE_PATTERN = /var\(\s*(--ws-[A-Za-z0-9_-]+)/g;
const ROOT_CONFIG_FILES = [
  "tailwind.config.cjs",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.ts",
];

function stripComments(content, { lineComments, maskStrings = false }) {
  const output = content.split("");
  let state = "normal";

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (state === "line-comment") {
      if (char === "\n") {
        state = "normal";
      } else {
        output[index] = " ";
      }
      continue;
    }
    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        output[index] = " ";
        output[index + 1] = " ";
        index += 1;
        state = "normal";
      } else if (char !== "\n") {
        output[index] = " ";
      }
      continue;
    }
    if (state !== "normal") {
      if (char === "\\") {
        if (maskStrings) {
          output[index] = " ";
          if (next && next !== "\n" && next !== "\r") {
            output[index + 1] = " ";
          }
        }
        index += 1;
        continue;
      }
      if (
        (state === "single-quote" && char === "'") ||
        (state === "double-quote" && char === '"') ||
        (state === "template" && char === "`")
      ) {
        if (maskStrings) output[index] = " ";
        state = "normal";
      } else if (maskStrings && char !== "\n" && char !== "\r") {
        output[index] = " ";
      }
      continue;
    }

    if (char === "'") {
      state = "single-quote";
      if (maskStrings) output[index] = " ";
    } else if (char === '"') {
      state = "double-quote";
      if (maskStrings) output[index] = " ";
    } else if (char === "`") {
      state = "template";
      if (maskStrings) output[index] = " ";
    } else if (char === "/" && next === "*") {
      output[index] = " ";
      output[index + 1] = " ";
      index += 1;
      state = "block-comment";
    } else if (lineComments && char === "/" && next === "/") {
      output[index] = " ";
      output[index + 1] = " ";
      index += 1;
      state = "line-comment";
    }
  }

  return output.join("");
}

function stripScriptComments(content, filePath) {
  const extension = path.extname(filePath);
  let ast;
  try {
    ast = parse(content, {
      comment: true,
      jsx: extension === ".jsx" || extension === ".tsx",
      range: true,
      sourceType: "module",
    });
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error.message}`);
  }

  const output = content.split("");
  for (const comment of ast.comments ?? []) {
    const [start, end] = comment.range ?? [];
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    for (let index = start; index < end; index += 1) {
      if (output[index] !== "\n" && output[index] !== "\r") {
        output[index] = " ";
      }
    }
  }
  return output.join("");
}

function collectSourceFiles(rootDir) {
  const files = [];

  const visit = (currentDir) => {
    const entries = fs
      .readdirSync(currentDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(absolutePath);
      }
    }
  };

  visit(rootDir);
  return files;
}

function collectTokenDefinitions(css) {
  const uncommentedCss = stripComments(css, {
    lineComments: false,
    maskStrings: true,
  });
  return new Set(
    [...uncommentedCss.matchAll(TOKEN_DEFINITION_PATTERN)].map((match) => match[1]),
  );
}

function collectTokenReferences(filePath, projectRoot) {
  const content = fs.readFileSync(filePath, "utf8");
  const extension = path.extname(filePath);
  const searchableContent =
    extension === ".css" || extension === ".json"
      ? stripComments(content, { lineComments: false })
      : stripScriptComments(content, filePath);
  const references = [];
  let line = 1;
  let nextNewline = searchableContent.indexOf("\n");

  for (const match of searchableContent.matchAll(TOKEN_REFERENCE_PATTERN)) {
    const tokenIndex = match.index + match[0].lastIndexOf(match[1]);
    while (nextNewline !== -1 && nextNewline < tokenIndex) {
      line += 1;
      nextNewline = searchableContent.indexOf("\n", nextNewline + 1);
    }
    references.push({
      token: match[1],
      file: path.relative(projectRoot, filePath).split(path.sep).join("/"),
      line,
    });
  }

  return references;
}

export function checkProject(projectRoot) {
  const tokensFile = path.join(projectRoot, "src", "styles", "index.css");
  const sourceRoot = path.join(projectRoot, "src");
  const definitions = collectTokenDefinitions(
    fs.readFileSync(tokensFile, "utf8"),
  );
  const sourceFiles = collectSourceFiles(sourceRoot);
  for (const configFile of ROOT_CONFIG_FILES) {
    const configPath = path.join(projectRoot, configFile);
    if (fs.existsSync(configPath)) sourceFiles.push(configPath);
  }
  sourceFiles.sort();
  const references = sourceFiles.flatMap((filePath) =>
    collectTokenReferences(filePath, projectRoot),
  );
  const undefinedReferences = references.filter(
    ({ token }) => !definitions.has(token),
  );
  const undefinedTokens = new Set(
    undefinedReferences.map(({ token }) => token),
  );

  return {
    definitionCount: definitions.size,
    referenceCount: references.length,
    undefinedReferences,
    undefinedTokenCount: undefinedTokens.size,
  };
}

function parseArgs(args) {
  let projectRoot = process.cwd();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--ci") continue;
    if (arg === "--root") {
      projectRoot = path.resolve(args[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return projectRoot;
}

function main() {
  try {
    const projectRoot = parseArgs(process.argv.slice(2));
    const result = checkProject(projectRoot);

    if (result.undefinedTokenCount === 0) {
      console.log(
        `CSS token check passed: 0 undefined tokens across ${result.referenceCount} references.`,
      );
      return;
    }

    console.log(
      `CSS token check failed: ${result.undefinedTokenCount} undefined tokens across ${result.undefinedReferences.length} references.`,
    );
    for (const reference of result.undefinedReferences) {
      console.log(`${reference.file}:${reference.line} ${reference.token}`);
    }
    process.exitCode = 1;
  } catch (error) {
    console.error(`CSS token check error: ${error.message}`);
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
