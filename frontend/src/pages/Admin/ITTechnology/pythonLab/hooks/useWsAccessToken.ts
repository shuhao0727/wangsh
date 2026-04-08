import { useCallback, useEffect, useRef, useState } from "react";
import { authApi, authTokenStorage, getCookieToken, getStoredAccessToken } from "@services/api";

export type WsAccessTokenStatus = "idle" | "loading" | "ready" | "error";

export function useWsAccessToken(params?: { enabled?: boolean; refreshIfMissing?: boolean }) {
    const enabled = params?.enabled ?? true;
    const refreshIfMissing = params?.refreshIfMissing ?? true;
    const [status, setStatus] = useState<WsAccessTokenStatus>("idle");
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inflightRef = useRef<Promise<string | null> | null>(null);

    const readToken = useCallback(() => {
        return getStoredAccessToken() || getCookieToken() || null;
    }, []);

    const ensureToken = useCallback(async () => {
        const existing = readToken();
        if (existing) return existing;
        if (!refreshIfMissing) return null;

        if (!inflightRef.current) {
            inflightRef.current = (async () => {
                try {
                    const resp = await authApi.refreshToken(undefined, { silent: true });
                    const raw: any = resp?.data;
                    const data: any = raw && typeof raw === "object" && "data" in raw ? (raw as any).data : raw;
                    if (data?.access_token || data?.refresh_token) {
                        authTokenStorage.set(data?.access_token ?? null, data?.refresh_token ?? null);
                    }
                } catch {
                } finally {
                    const next = readToken();
                    inflightRef.current = null;
                    return next;
                }
            })();
        }

        return inflightRef.current;
    }, [readToken, refreshIfMissing]);

    const refresh = useCallback(async () => {
        setStatus("loading");
        setError(null);
        const t = await ensureToken();
        if (t) {
            setToken(t);
            setStatus("ready");
            return t;
        }
        setToken(null);
        setStatus("error");
        setError("登录已过期，请重新登录");
        return null;
    }, [ensureToken]);

    useEffect(() => {
        if (!enabled) {
            setStatus("idle");
            setToken(null);
            setError(null);
            return;
        }
        const t = readToken();
        if (t) {
            setToken(t);
            setStatus("ready");
            setError(null);
            return;
        }
        if (!refreshIfMissing) {
            setToken(null);
            setStatus("error");
            setError("登录已过期，请重新登录");
            return;
        }
        refresh();
    }, [enabled, readToken, refresh, refreshIfMissing]);

    return { status, token, error, refresh };
}
