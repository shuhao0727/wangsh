const path = require("path");

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
  },

  // 可选：如果需要修改其他配置可以在这里添加
  devServer: {
    // 开发服务器配置
  },

  plugins: [
    // 可以添加插件
  ],
};
