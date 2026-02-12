/**
 * 前端配置服务
 * 从环境变量读取配置，提供统一的配置访问
 */

import { logger } from "./logger";

export interface AppConfig {
  // API 配置
  apiUrl: string;

  // 应用配置
  env: "development" | "production" | "test";
  version: string;

  // 外部服务链接
  difyUrl: string;
  nasUrl: string;

  // 功能开关
  features: {
    analytics: boolean;
    debug: boolean;
  };
}

export interface FeatureFlags {
  analytics: boolean;
  debug: boolean;
}

// 从环境变量构建配置
const getConfig = (): AppConfig => {
  // 优先使用环境变量；开发环境默认直连后端 http://localhost:8000/api/v1
  const env =
    (process.env.REACT_APP_ENV as "development" | "production" | "test") ||
    "development";
  const apiUrl =
    process.env.REACT_APP_API_URL ||
    (env === "development" ? "http://localhost:8000/api/v1" : "/api/v1");
  const difyUrl = process.env.REACT_APP_DIFY_URL || "";
  const nasUrl = process.env.REACT_APP_NAS_URL || "";

  return {
    apiUrl,
    env,
    version: process.env.REACT_APP_VERSION || "1.0.0",
    difyUrl,
    nasUrl,

    features: {
      analytics: env === "production",
      debug: env === "development",
    },
  };
};

// 全局配置实例
export const config = getConfig();

// 环境变量检查（开发环境）
if (config.env === "development") {
  logger.debug("📋 前端配置:", {
    apiUrl: config.apiUrl,
    env: config.env,
    version: config.version,
  });
}

export default config;
