/** @type {import('jest').Config} */
module.exports = {
  roots: ["<rootDir>/src"],

  // .tsx 测试默认需要 DOM；纯逻辑 .ts 测试用 node 更快
  testEnvironment: "node",
  testEnvironmentOptions: {},

  // 按文件后缀选择环境：.tsx 自动用 jsdom
  projects: [
    {
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^@components/(.*)$": "<rootDir>/src/components/$1",
        "^@pages/(.*)$": "<rootDir>/src/pages/$1",
        "^@layouts/(.*)$": "<rootDir>/src/layouts/$1",
        "^@services$": "<rootDir>/src/services/index",
        "^@services/(.*)$": "<rootDir>/src/services/$1",
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
        "^@assets/(.*)$": "<rootDir>/src/assets/$1",
        "^@styles/(.*)$": "<rootDir>/src/styles/$1",
      },
    },
    {
      displayName: "jsdom",
      testEnvironment: "jest-environment-jsdom",
      testMatch: ["<rootDir>/src/**/*.test.tsx"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^@components/(.*)$": "<rootDir>/src/components/$1",
        "^@pages/(.*)$": "<rootDir>/src/pages/$1",
        "^@layouts/(.*)$": "<rootDir>/src/layouts/$1",
        "^@services$": "<rootDir>/src/services/index",
        "^@services/(.*)$": "<rootDir>/src/services/$1",
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
        "^@assets/(.*)$": "<rootDir>/src/assets/$1",
        "^@styles/(.*)$": "<rootDir>/src/styles/$1",
      },
    },
  ],
};
