import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { copyFileSync, mkdirSync } from "fs";
import { join } from "path";

type VisualizerModule = {
  visualizer: (options: {
    filename: string;
    template: "treemap";
    open: boolean;
    gzipSize: boolean;
    brotliSize: boolean;
  }) => PluginOption;
};

const importOptionalModule = new Function(
  "specifier",
  "return import(specifier)"
) as (specifier: string) => Promise<VisualizerModule>;

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  // 加载 .env 文件
  const env = loadEnv(mode, process.cwd(), "");
  const isAnalyze = process.env.ANALYZE === "true";

  const plugins: PluginOption[] = [
    react(),
      // 自定义插件：复制 PDF worker 文件到构建输出目录
      {
        name: "copy-pdf-worker",
        closeBundle() {
          if (process.env.NODE_ENV === "production") {
            try {
              // 源文件：node_modules 中的 PDF worker
              const pdfWorkerSource = join(
                __dirname,
                "node_modules/pdfjs-dist/build/pdf.worker.js"
              );
              // 目标文件：构建输出目录
              const pdfWorkerDest = join(__dirname, "build/assets/pdf.worker.js");

              copyFileSync(pdfWorkerSource, pdfWorkerDest);
              console.log("PDF worker file copied to:", pdfWorkerDest);
            } catch (error) {
              console.error("Failed to copy PDF worker file:", error);
            }
          }
        },
      },
    ];

    if (isAnalyze) {
      const { visualizer } = await importOptionalModule("rollup-plugin-visualizer");
      plugins.push(
        visualizer({
          filename: "build/stats.html",
          template: "treemap",
          open: false,
          gzipSize: true,
          brotliSize: true,
        })
      );
    }

    return {
      plugins,
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
      // 允许访问 node_modules 中的文件（用于 PDF worker）
      fs: {
        allow: [".."], // 允许访问父目录（包含 node_modules）
      },
    },

    // 构建配置
    build: {
      outDir: "build", // 与 CRA 保持一致（CRA 默认输出到 build/）
      sourcemap: mode !== "production",
      cssCodeSplit: false,
      // 关闭自动 modulepreload，避免首页提前下载 Monaco/Graphviz 等重型功能包。
      // 动态 import 仍会在进入对应页面或组件时正常拉取依赖。
      modulePreload: false,
      // 分包策略
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            const normalizedId = id.replaceAll("\\", "/");
            const modulePath = normalizedId.split("node_modules/").pop();
            if (!modulePath) {
              return undefined;
            }

            const isPackage = (name: string) =>
              modulePath === name || modulePath.startsWith(`${name}/`);

            if (
              isPackage("@monaco-editor/react") ||
              isPackage("monaco-editor")
            ) {
              return "monaco-vendor";
            }

            if (
              isPackage("react") ||
              isPackage("react-dom") ||
              isPackage("react-router") ||
              isPackage("react-router-dom") ||
              isPackage("scheduler")
            ) {
              return "react-vendor";
            }

            if (
              isPackage("echarts") ||
              isPackage("echarts-for-react") ||
              isPackage("zrender")
            ) {
              return "echarts-vendor";
            }

            if (isPackage("pdfjs-dist")) {
              return "pdf-vendor";
            }

            if (
              isPackage("@hpcc-js/wasm") ||
              modulePath.startsWith("@hpcc-js/wasm/")
            ) {
              return "graphviz-vendor";
            }

            if (
              isPackage("@myriaddreamin/typst.ts") ||
              isPackage("@myriaddreamin/typst-ts-renderer") ||
              isPackage("@myriaddreamin/typst-ts-web-compiler")
            ) {
              return "typst-vendor";
            }

            if (
              isPackage("xterm") ||
              isPackage("xterm-addon-fit") ||
              isPackage("xterm-addon-webgl")
            ) {
              return "terminal-vendor";
            }

            if (
              isPackage("react-markdown") ||
              isPackage("remark-gfm") ||
              isPackage("remark-math") ||
              isPackage("remark-parse") ||
              isPackage("remark-rehype") ||
              isPackage("rehype-katex") ||
              isPackage("katex") ||
              isPackage("unified") ||
              isPackage("micromark") ||
              modulePath.startsWith("micromark-") ||
              modulePath.startsWith("mdast-") ||
              modulePath.startsWith("hast-") ||
              modulePath.startsWith("unist-") ||
              modulePath.startsWith("vfile")
            ) {
              return "markdown-vendor";
            }

            return undefined;
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
