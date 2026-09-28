import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import { aiPartnerTheme } from "./vite.ai-partner-theme";

// Keep the classroom app independent of the main platform's heavy bundles.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const variables = ["ENV", "API_URL", "VERSION", "DIFY_URL", "NAS_URL", "DEBUG_LOG"];
  return {
    plugins: [aiPartnerTheme()],
    root: path.resolve(__dirname, "ai-partner"),
    envDir: __dirname,
    publicDir: path.resolve(__dirname, "public/games/ai-partner"),
    base: "/games/ai-partner/",
    envPrefix: ["VITE_", "REACT_APP_"],
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      ...Object.fromEntries(variables.map((key) => [
        `process.env.REACT_APP_${key}`,
        JSON.stringify(env[`REACT_APP_${key}`] || env[`VITE_${key === "ENV" || key === "VERSION" ? "APP_" : ""}${key}`] || (key === "ENV" ? mode : "")),
      ])),
    },
    build: {
      outDir: path.resolve(__dirname, "build/games/ai-partner"),
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      host: "127.0.0.1",
      port: 16609,
      fs: { allow: [__dirname] },
      proxy: { "/api": { target: env.DEV_PROXY_TARGET || "http://localhost:8000", changeOrigin: true } },
    },
  };
});
