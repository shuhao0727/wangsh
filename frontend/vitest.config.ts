import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@pages": path.resolve(__dirname, "src/pages"),
      "@layouts": path.resolve(__dirname, "src/layouts"),
      "@services": path.resolve(__dirname, "src/services"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@assets": path.resolve(__dirname, "src/assets"),
      "@styles": path.resolve(__dirname, "src/styles"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: false,
    // PythonLab 是核心交互模块，纳入默认门禁防止流程图/调试/终端能力回归。
    // Query hooks 和 service 层覆盖键值稳定性与 API 形状。
    include: [
      "src/components/**/*.test.{ts,tsx}",
      "src/pages/AIAgents/**/*.test.{ts,tsx}",
      "src/pages/Admin/ITTechnology/pythonLab/**/*.test.{ts,tsx}",
      "src/hooks/queries/**/*.test.{ts,tsx}",
      "src/lib/**/*.test.{ts,tsx}",
      "src/services/**/*.test.{ts,tsx}",
    ],
  },
});
