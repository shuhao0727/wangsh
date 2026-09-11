import config from "@services/config";

export interface AppMeta {
  version: string;
  envLabel: string;
}

const normalizeVersion = (v?: string | null): string => {
  const s = String(v ?? "").trim();
  if (!s || s.toLowerCase() === "unknown") return "–";
  return s;
};

const readEnvLabel = (): string => {
  const envStr = String((config as unknown as { env?: string })?.env || "").trim();
  if (!envStr) return "本地开发";
  if (envStr === "development") return "本地开发";
  if (envStr === "production") return "生产环境";
  if (envStr === "test") return "测试环境";
  return envStr;
};

// Build metadata is public and identity-independent; never query privileged system APIs.
export const useAppMeta = (): AppMeta => ({
  version: normalizeVersion(config.version),
  envLabel: readEnvLabel(),
});

export default useAppMeta;
