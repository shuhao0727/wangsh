export interface TerminalConnectionState {
  sessionId: string;
  ready: boolean;
}

const READY_FRAME = '{"type":"pythonlab.terminal.ready","version":1}';

export function isTerminalReadyFrame(data: unknown): boolean {
  if (!(data instanceof ArrayBuffer) || data.byteLength !== READY_FRAME.length) return false;
  return new Uint8Array(data).every((value, index) => value === READY_FRAME.charCodeAt(index));
}

type Waiter = { resolve: () => void; reject: (error: Error) => void };

export function createTerminalReadiness() {
  let sessionId: string | null = null;
  let ready = false;
  const waiters = new Set<Waiter>();
  const cancel = () => {
    ready = false;
    for (const waiter of [...waiters]) waiter.reject(new Error("终端等待已取消"));
  };
  return {
    select(nextSessionId: string) {
      cancel();
      sessionId = nextSessionId;
    },
    reset() {
      cancel();
      sessionId = null;
    },
    update(nextSessionId: string, nextReady: boolean) {
      if (nextSessionId !== sessionId) return;
      ready = nextReady;
      if (ready) for (const waiter of [...waiters]) waiter.resolve();
    },
    isReady(expectedSessionId: string) {
      return expectedSessionId === sessionId && ready;
    },
    wait(expectedSessionId: string, timeoutMs = 10000, signal?: AbortSignal): Promise<void> {
      if (expectedSessionId !== sessionId || signal?.aborted) return Promise.reject(new Error("终端等待已取消"));
      if (ready) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          waiters.delete(waiter);
          if (error) reject(error);
          else resolve();
        };
        const abort = () => finish(new Error("终端等待已取消"));
        const waiter: Waiter = { resolve: () => finish(), reject: finish };
        const timer = setTimeout(() => finish(new Error("终端连接未就绪，请停止后重试")), timeoutMs);
        waiters.add(waiter);
        signal?.addEventListener("abort", abort, { once: true });
      });
    },
  };
}
