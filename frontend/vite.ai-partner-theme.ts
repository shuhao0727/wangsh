import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import type { Plugin } from "vite";

// Share only tokens, not the platform's resets/layout, with the teaching scene.
export function aiPartnerTheme(): Plugin {
  const id = "virtual:wangsh-theme-tokens.css";
  const resolved = "\0" + id;
  const source = path.resolve(__dirname, "src/styles/index.css");
  return {
    name: "ai-partner-platform-theme-tokens",
    resolveId(request) { if (request === id) return resolved; },
    load(request) {
      if (request !== resolved) return;
      this.addWatchFile(source);
      const sheet = postcss.parse(readFileSync(source, "utf8"));
      const declarations: string[] = [];
      for (const rule of sheet.nodes) {
        if (rule.type !== "rule" || rule.selector !== ":root") continue;
        for (const node of rule.nodes) {
          if (node.type === "decl" && node.prop.startsWith("--")) declarations.push(node.toString());
        }
      }
      if (!declarations.length) throw new Error("Platform theme tokens not found");
      return `:root {\n${declarations.join(";\n")}\n}`;
    },
  };
}
