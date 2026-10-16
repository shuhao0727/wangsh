import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Close a launched tab, or return a directly opened page to its owning screen. */
export function useStandaloneReturn(destination: string) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (fallbackTimer.current !== null) clearTimeout(fallbackTimer.current);
  }, []);

  return useCallback(() => {
    if (fallbackTimer.current !== null) clearTimeout(fallbackTimer.current);
    const launchedTab = new URLSearchParams(search).get("launch") === "tab" || Boolean(window.opener);
    if (!launchedTab) {
      void navigate(destination, { replace: true });
      return;
    }

    window.close();
    fallbackTimer.current = setTimeout(() => {
      fallbackTimer.current = null;
      if (!window.closed) void navigate(destination, { replace: true });
    }, 150);
  }, [destination, navigate, search]);
}
