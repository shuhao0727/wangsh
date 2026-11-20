import { useEffect, useMemo, useState } from "react";
import { forgetPythonlabSession, pythonlabSessionApi, pythonlabSessionNotFound, trackedPythonlabSession } from "../services/pythonlabSessionApi";

export function usePriorPythonlabSession(scope?: string) {
  // Read when this account/experiment opens, not when this page creates a new session.
  const sessionId = useMemo(() => scope ? trackedPythonlabSession(scope) : null, [scope]);
  const [cleared, setCleared] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const activeId = sessionId === cleared ? null : sessionId;

  useEffect(() => {
    if (!scope || !sessionId) return;
    let cancelled = false;
    const remove = () => {
      if (cancelled) return;
      forgetPythonlabSession(scope, sessionId);
      setCleared(sessionId);
    };
    void pythonlabSessionApi.get(sessionId).then((meta) => {
      if (meta.status === "TERMINATED" && meta.stop_confirmed) remove();
    }).catch((reason: unknown) => {
      if (pythonlabSessionNotFound(reason)) remove();
    });
    return () => { cancelled = true; };
  }, [scope, sessionId]);

  const stop = async () => {
    if (!scope || !activeId || stopping === activeId) return;
    setError(null);
    setStopping(activeId);
    try {
      await pythonlabSessionApi.stopAndWait(activeId, scope);
      setCleared(activeId);
    } catch (reason) {
      if (pythonlabSessionNotFound(reason)) {
        forgetPythonlabSession(scope, activeId);
        setCleared(activeId);
      } else {
        setError({ id: activeId, message: (reason as Error)?.message || "停止未确认，请重试" });
      }
    } finally {
      setStopping(null);
    }
  };
  return { sessionId: activeId, stopping: stopping === activeId && activeId !== null, error: error?.id === activeId ? error.message : null, stop };
}
