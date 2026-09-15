const RETRY_STORAGE_KEY = "wangsh:chunk-load-recovery-at";
const RETRY_WINDOW_MS = 30_000;

/**
 * Recover once when an already-open page requests a chunk from a previous build.
 * Vite emits this event when a dynamic import/preload cannot be fetched.
 */
export interface ChunkLoadRecoveryOptions {
  reload?: () => void;
  now?: () => number;
}

export function installChunkLoadRecovery(options: ChunkLoadRecoveryOptions = {}): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const reload = options.reload ?? (() => window.location.reload());
  const now = options.now ?? Date.now;

  const handlePreloadError = (event: Event) => {
    let shouldReload = true;

    try {
      const previousAttempt = Number(window.sessionStorage.getItem(RETRY_STORAGE_KEY));
      if (Number.isFinite(previousAttempt) && now() - previousAttempt < RETRY_WINDOW_MS) {
        shouldReload = false;
      } else {
        window.sessionStorage.setItem(RETRY_STORAGE_KEY, String(now()));
      }
    } catch {
      // If sessionStorage is unavailable, still attempt the one safe recovery.
    }

    // Let Vite/React show the normal error boundary after a retry has already
    // failed; this avoids an infinite reload loop on a genuinely broken build.
    if (!shouldReload) {
      return;
    }

    event.preventDefault();
    reload();
  };

  window.addEventListener("vite:preloadError", handlePreloadError);
  return () => window.removeEventListener("vite:preloadError", handlePreloadError);
}
