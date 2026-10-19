import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The backend copy is the maintenance source and its self-contained runtime asset.
// Commit the generated frontend copy so each Docker build context stays independent.
export function syncCatalog(repoRoot, write = false) {
  const source = path.join(repoRoot, "backend/app/services/ai_partner_catalog.json");
  const target = path.join(repoRoot, "frontend/ai-partner/src/catalog.json");
  const bytes = fs.readFileSync(source);
  JSON.parse(bytes.toString("utf8"));
  if (fs.existsSync(target) && bytes.equals(fs.readFileSync(target))) return "unchanged";
  if (!write) {
    throw new Error("AI partner catalog differs: edit backend/app/services/ai_partner_catalog.json, then run node scripts/sync-ai-partner-catalog.mjs --write and commit both copies.");
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return "updated";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && !["--check", "--write"].includes(args[0]))) {
      throw new Error("Usage: node scripts/sync-ai-partner-catalog.mjs [--check|--write]");
    }
    const root = fileURLToPath(new URL("../", import.meta.url));
    console.log(`AI partner catalog: ${syncCatalog(root, args[0] === "--write")}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
