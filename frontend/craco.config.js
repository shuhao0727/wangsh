const path = require("path");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = {
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
    // 开发服务器配置
  },

  plugins: [
    // 可以添加插件
  ],
};
