import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["ai-partner/src/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
