import { logger } from "@services/logger";

export interface DapMessage {
  type: "request" | "response" | "event";
  seq?: number;
  request_seq?: number;
  success?: boolean;
  message?: string;
  command?: string;
  event?: string;
  body?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

type DapEventHandler = (msg: DapMessage) => void;
type DapCloseHandler = (ev: CloseEvent) => void;

export class DebugController {
  private ws: WebSocket | null = null;
  private seq = 1;
  private pending = new Map<number, { resolve: (v: DapMessage) => void; reject: (e: Error) => void }>();
  private eventHandlers: Record<string, DapEventHandler> = {};
  private closeHandler: DapCloseHandler | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      let settled = false;
      this.ws = ws;
      ws.onopen = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      ws.onerror = () => {
        if (settled) return;
        settled = true;
        reject(new Error("WebSocket connection failed"));
      };
      ws.onclose = (ev) => {
        if (this.ws === ws) {
          this.ws = null;
        }
        this.pending.forEach((p) => p.reject(new Error(`WebSocket closed (${ev.code})`)));
        this.pending.clear();
        if (!settled) {
          settled = true;
          reject(new Error(`WebSocket closed (${ev.code})`));
        }
        if (this.closeHandler) this.closeHandler(ev);
      };
      ws.onmessage = (ev) => this.handleMessage(ev.data);
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.pending.forEach((p) => p.reject(new Error("Disconnected")));
    this.pending.clear();
  }

  on(event: "close", handler: DapCloseHandler): void;
  on(event: string, handler: DapEventHandler): void;
  on(event: string, handler: DapEventHandler | DapCloseHandler) {
    if (event === "close") {
      this.closeHandler = handler as DapCloseHandler;
      return;
    }
    this.eventHandlers[event] = handler as DapEventHandler;
  }

  request(command: string, args: Record<string, unknown> = {}, timeout = 5000): Promise<DapMessage> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Not connected"));
    }

    const seq = this.seq++;
    const promise = new Promise<DapMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`Timeout: ${command}`));
      }, timeout);
      this.pending.set(seq, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });

    this.ws.send(
      JSON.stringify({
        seq,
        type: "request",
        command,
        arguments: args,
      })
    );
    return promise;
  }

  async requestWithRetry(
    command: string,
    args: Record<string, unknown>,
    timeout: number,
    retry = 1
  ): Promise<DapMessage> {
    let lastErr: unknown = null;
    for (let i = 0; i <= retry; i += 1) {
      try {
        return await this.request(command, args, timeout);
      } catch (err) {
        lastErr = err;
        if (i >= retry) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    throw lastErr;
  }

  sendStdin(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: "stdin",
        body: { data: text },
      })
    );
  }

  private emit(event: string, msg: DapMessage) {
    if (this.eventHandlers[event]) this.eventHandlers[event](msg);
  }

  private handleMessage(data: unknown) {
    try {
      const msg = JSON.parse(String(data)) as DapMessage;
      if (msg.type === "response") {
        const pending = this.pending.get(msg.request_seq!);
        if (!pending) return;
        this.pending.delete(msg.request_seq!);
        if (msg.success) pending.resolve(msg);
        else pending.reject(new Error(msg.message || "Request failed"));
        return;
      }
      if (msg.type === "event" && msg.event) {
        this.emit(msg.event, msg);
      }
    } catch (e) {
      logger.error("Failed to parse DAP message", e);
    }
  }

  initializePythonSession(timeout = 20000, retry = 2): Promise<DapMessage> {
    return this.requestWithRetry(
      "initialize",
      {
        adapterID: "python",
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: "path",
      },
      timeout,
      retry
    );
  }

  attachPythonSession(timeout = 20000, retry = 1): Promise<DapMessage> {
    return this.requestWithRetry(
      "attach",
      {
        name: "Remote",
        type: "python",
        request: "attach",
        redirectOutput: true,
        pathMappings: [
          {
            localRoot: "/workspace",
            remoteRoot: "/workspace",
          },
        ],
        justMyCode: true,
      },
      timeout,
      retry
    );
  }

  sendConfigurationDone(timeout = 10000): Promise<DapMessage> {
    return this.request("configurationDone", {}, timeout);
  }

  setSourceBreakpoints(
    sourcePath: string,
    breakpoints: Array<{ line: number; condition?: string; hitCondition?: string }>,
    timeout = 5000
  ): Promise<DapMessage> {
    return this.request(
      "setBreakpoints",
      {
        source: { path: sourcePath },
        breakpoints,
      },
      timeout
    );
  }

  getStackTrace(threadId: number, startFrame = 0, levels = 20, timeout = 5000): Promise<DapMessage> {
    return this.request("stackTrace", { threadId, startFrame, levels }, timeout);
  }

  getScopes(frameId: number, timeout = 5000): Promise<DapMessage> {
    return this.request("scopes", { frameId }, timeout);
  }

  getVariables(variablesReference: number, timeout = 5000): Promise<DapMessage> {
    return this.request("variables", { variablesReference }, timeout);
  }

  evaluateExpression(
    expression: string,
    options: { frameId?: number; context?: "repl" | "watch" } = {},
    timeout = 5000
  ): Promise<DapMessage> {
    return this.request(
      "evaluate",
      {
        expression,
        frameId: options.frameId,
        context: options.context ?? "repl",
      },
      timeout
    );
  }

  disconnectSession(timeout = 1200): Promise<DapMessage> {
    return this.request("disconnect", { terminateDebuggee: true }, timeout);
  }

  continueRun(threadId = 1, timeout = 5000): Promise<DapMessage> {
    return this.request("continue", { threadId }, timeout);
  }

  pauseRun(threadId = 1, timeout = 5000): Promise<DapMessage> {
    return this.request("pause", { threadId }, timeout);
  }

  stepOver(threadId = 1, timeout = 5000): Promise<DapMessage> {
    return this.request("next", { threadId }, timeout);
  }

  stepInto(threadId = 1, timeout = 5000): Promise<DapMessage> {
    return this.request("stepIn", { threadId }, timeout);
  }

  stepOut(threadId = 1, timeout = 5000): Promise<DapMessage> {
    return this.request("stepOut", { threadId }, timeout);
  }
}
