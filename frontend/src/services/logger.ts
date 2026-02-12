const isDebugEnabled = () => {
  const debugFlag =
    typeof window !== "undefined"
      ? window.localStorage.getItem("debug") || window.localStorage.getItem("DEBUG")
      : null;
  if (debugFlag === "1" || debugFlag === "true") return true;

  const appEnv = process.env.REACT_APP_ENV;
  const envEnabled = process.env.REACT_APP_DEBUG_LOG === "true";
  if (appEnv) return appEnv === "development" && envEnabled;
  return process.env.NODE_ENV !== "production" && envEnabled;
};

type LogArgs = unknown[];

export const logger = {
  debug: (...args: LogArgs) => {
    if (!isDebugEnabled()) return;
    const c = (globalThis as any)["console"];
    c?.log?.(...args);
  },
  info: (...args: LogArgs) => {
    if (!isDebugEnabled()) return;
    const c = (globalThis as any)["console"];
    c?.info?.(...args);
  },
  warn: (...args: LogArgs) => {
    const c = (globalThis as any)["console"];
    c?.warn?.(...args);
  },
  error: (...args: LogArgs) => {
    const c = (globalThis as any)["console"];
    c?.error?.(...args);
  },
};
