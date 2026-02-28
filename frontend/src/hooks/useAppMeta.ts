import { useEffect, useState } from "react";
import { api } from "@services";
import config from "@services/config";
import { logger } from "@services/logger";

export interface AppMeta {
  version: string;
  envLabel: string;
}

let cachedMeta: AppMeta | null = null;
let loadingPromise: Promise<AppMeta> | null = null;

const normalizeVersion = (v?: string | null): string => {
  const s = String(v ?? "").trim();
  if (!s || s.toLowerCase() === "unknown") return "–";
  return s;
};

const readEnvLabel = (): string => {
  const envStr = String((config as any)?.env || "").trim();
  if (!envStr) return "本地开发";
  if (envStr === "development") return "本地开发";
  if (envStr === "production") return "生产环境";
  if (envStr === "test") return "测试环境";
  return envStr;
};

const fetchMeta = async (): Promise<AppMeta> => {
  // 版本优先级：
  // 1) /api/v1/system/overview.version
  // 2) REACT_APP_VERSION 或 APP_VERSION
  // 3) /api/v1/system/settings.project.version
  // 4) "–"
  let version: string | undefined;

  // 尝试 1)：system/overview
  try {
    const resp = await api.get<any>("/system/overview");
    const data: any = resp?.data;
    // 兼容返回结构：可能是 { data: {...} } 或直接 {...}
    const ver =
      (data && (data as any).version) ||
      (data && (data as any).data && (data as any).data.version);
    version = normalizeVersion(ver);
    if (version !== "–") {
      logger.debug?.("AppMeta: overview.version 命中", { version });
    }
  } catch {
    // ignore
  }

  // 尝试 2)：环境变量
  if (!version || version === "–") {
    const vEnv =
      config?.version || // 兼容旧逻辑（但会被标准化去除 unknown）
      "";
    version = normalizeVersion(vEnv);
    if (version !== "–") {
      logger.debug?.("AppMeta: 来自环境变量/配置", { version });
    }
  }

  // 尝试 3)：system/settings
  if (!version || version === "–") {
    try {
      const resp = await api.get<any>("/system/settings");
      const data: any = resp?.data;
      const ver =
        (data && (data as any).project && (data as any).project.version) ||
        (data && (data as any).VERSION);
      version = normalizeVersion(ver);
      if (version !== "–") {
        logger.debug?.("AppMeta: settings.VERSION 命中", { version });
      }
    } catch {
      // ignore
    }
  }

  // 兜底
  if (!version) version = "–";

  const envLabel = readEnvLabel();
  return { version, envLabel };
};

export const useAppMeta = (): AppMeta => {
  const [meta, setMeta] = useState<AppMeta>(cachedMeta ?? { version: "–", envLabel: readEnvLabel() });

  useEffect(() => {
    let mounted = true;
    if (cachedMeta) {
      setMeta(cachedMeta);
      return;
    }
    if (!loadingPromise) {
      loadingPromise = fetchMeta()
        .then((m) => {
          cachedMeta = m;
          return m;
        })
        .finally(() => {
          loadingPromise = null;
        });
    }
    loadingPromise.then((m) => {
      if (mounted) setMeta(m);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return meta;
};

export default useAppMeta;
