const path = require("path");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const tailwindcss = require("tailwindcss");

module.exports = {
  style: {
    postcss: {
      plugins: (plugins) => [tailwindcss, ...plugins],
    },
  },
  webpack: {
    alias: {
      // 根路径别名
      "@": path.resolve(__dirname, "src"),

      // 模块路径别名（精确匹配 tsconfig.json）
      "@components/*": path.resolve(__dirname, "src/components/*"),
      "@pages/*": path.resolve(__dirname, "src/pages/*"),
      "@layouts/*": path.resolve(__dirname, "src/layouts/*"),
      "@services/*": path.resolve(__dirname, "src/services/*"),
      "@utils/*": path.resolve(__dirname, "src/utils/*"),
      "@hooks/*": path.resolve(__dirname, "src/hooks/*"),
      "@assets/*": path.resolve(__dirname, "src/assets/*"),
      "@styles/*": path.resolve(__dirname, "src/styles/*"),

      // 特殊别名 - 精确匹配 tsconfig.json 中的配置
      "@services": path.resolve(__dirname, "src/services/index"),
      "@services/znt/*": path.resolve(__dirname, "src/services/znt/*"),
    },
    configure: (webpackConfig) => {
      const already = (webpackConfig.plugins || []).some((p) => p && p.constructor && p.constructor.name === "MonacoWebpackPlugin");
      if (!already) {
        webpackConfig.plugins = webpackConfig.plugins || [];
        webpackConfig.plugins.push(
          new MonacoWebpackPlugin({
            languages: ["python"],
            filename: "static/[name].worker.js",
          })
        );
      }
      return webpackConfig;
    },
  },

  // 可选：如果需要修改其他配置可以在这里添加
  devServer: {
    client: {
      overlay: false,
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      '/api/v1/ai-agents/stream': {
        target: process.env.DEV_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
        selfHandleResponse: true,
        onProxyRes: (proxyRes, req, res) => {
          // 写入响应头，禁用所有缓冲
          res.writeHead(proxyRes.statusCode, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache, no-transform',
            'x-accel-buffering': 'no',
            'connection': 'keep-alive',
            'transfer-encoding': 'chunked',
          });
          // 逐块转发，不使用 pipe（pipe 有内部缓冲）
          proxyRes.on('data', (chunk) => {
            res.write(chunk);
            if (typeof res.flush === 'function') res.flush();
          });
          proxyRes.on('end', () => {
            res.end();
          });
          proxyRes.on('error', () => {
            res.end();
          });
        },
      },
      '/api': {
        target: process.env.DEV_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  jest: {
    configure: (jestConfig) => {
      jestConfig.moduleNameMapper = {
        ...jestConfig.moduleNameMapper,
        "^@services/(.*)$": "<rootDir>/src/services/$1",
        "^@services$": "<rootDir>/src/services/index",
        "^@components/(.*)$": "<rootDir>/src/components/$1",
        "^@pages/(.*)$": "<rootDir>/src/pages/$1",
        "^@layouts/(.*)$": "<rootDir>/src/layouts/$1",
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
        "^@assets/(.*)$": "<rootDir>/src/assets/$1",
        "^@styles/(.*)$": "<rootDir>/src/styles/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
      };
      return jestConfig;
    },
  },

  plugins: [
    // 可以添加插件
  ],
};
