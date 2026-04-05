import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载 .env 文件
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],

    // 模块解析 — 继承自旧前端配置与 tsconfig.json 的路径别名
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

    // 开发服务器 — 继承自旧开发代理配置
    server: {
      port: 6608,
      host: true,
      // 禁用错误覆盖层（与 craco 配置一致）
      hmr: {
        overlay: false,
      },
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
      proxy: {
        // SSE 流式代理 — 需要特殊处理以禁用缓冲
        "/api/v1/ai-agents/stream": {
          target: env.DEV_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
        },
        // 通用 API 代理
        "/api": {
          target: env.DEV_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
          ws: true,
        },
      },
    },

    // 构建配置
    build: {
      outDir: "build", // 与 CRA 保持一致（CRA 默认输出到 build/）
      sourcemap: mode !== "production",
      // 分包策略
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/react-router")) {
              return "vendor";
            }
            if (id.includes("node_modules/echarts")) {
              return "echarts";
            }
          },
        },
      },
    },

    // 依赖预构建优化
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "axios",
        "dayjs",
      ],
    },

    // 环境变量前缀 — 兼容 CRA 的 REACT_APP_ 和 Vite 的 VITE_
    envPrefix: ["VITE_", "REACT_APP_"],

    // CSS 配置
    css: {
      // PostCSS 由 postcss.config.js 自动加载
    },

    // 定义全局常量 — 兼容 CRA 的 process.env 用法
    define: {
      // 兼容 process.env.NODE_ENV（Vite 已自动处理 import.meta.env.MODE）
      "process.env.NODE_ENV": JSON.stringify(mode),
      // 兼容 CRA 的 REACT_APP_* 环境变量
      "process.env.REACT_APP_ENV": JSON.stringify(
        env.REACT_APP_ENV || env.VITE_APP_ENV || mode
      ),
      "process.env.REACT_APP_API_URL": JSON.stringify(
        env.REACT_APP_API_URL || env.VITE_API_URL || ""
      ),
      "process.env.REACT_APP_VERSION": JSON.stringify(
        env.REACT_APP_VERSION || env.VITE_APP_VERSION || ""
      ),
      "process.env.REACT_APP_DIFY_URL": JSON.stringify(
        env.REACT_APP_DIFY_URL || env.VITE_DIFY_URL || ""
      ),
      "process.env.REACT_APP_NAS_URL": JSON.stringify(
        env.REACT_APP_NAS_URL || env.VITE_NAS_URL || ""
      ),
      "process.env.REACT_APP_DEBUG_LOG": JSON.stringify(
        env.REACT_APP_DEBUG_LOG || env.VITE_DEBUG_LOG || ""
      ),
      "process.env.REACT_APP_PYTHONLAB_RUNTIME": JSON.stringify(
        env.REACT_APP_PYTHONLAB_RUNTIME || env.VITE_PYTHONLAB_RUNTIME || ""
      ),
      "process.env.REACT_APP_PYODIDE_BASE_URL": JSON.stringify(
        env.REACT_APP_PYODIDE_BASE_URL || env.VITE_PYODIDE_BASE_URL || ""
      ),
      "process.env.REACT_APP_PYTHONLAB_DEBUG_FRONTEND_MODE": JSON.stringify(
        env.REACT_APP_PYTHONLAB_DEBUG_FRONTEND_MODE ||
          env.VITE_PYTHONLAB_DEBUG_FRONTEND_MODE ||
          ""
      ),
    },
  };
});
