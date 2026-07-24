import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/pages/ITTechnology/index.tsx"),
  "utf8",
);

describe("IT technology progress API contract", () => {
  it("only maps supported learning modules to progress endpoints", () => {
    expect(pageSource).toContain("it_machine_learning_enabled: 'ml'");
    expect(pageSource).toContain("it_ai_exploration_enabled: 'ai'");
    expect(pageSource).toContain("it_agent_exploration_enabled: 'agents'");
    expect(pageSource).not.toMatch(
      /it_game_lock_cracker_enabled:\s*['"]games['"]/,
    );
  });
});
