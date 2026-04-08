import fs from "fs";
import path from "path";
import { chromium } from "playwright";

function getArg(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function getArgs(name) {
  const values = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && i + 1 < process.argv.length) {
      values.push(process.argv[i + 1]);
      i += 1;
    }
  }
  return values;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

async function attachDiagnostics(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") diagnostics.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push(String(error));
  });
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()?.errorText || "requestfailed",
    });
  });
  page.on("response", async (response) => {
    if (response.status() >= 400) {
      diagnostics.badResponses.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
      });
    }
  });

  return diagnostics;
}

const baseUrl = (getArg("--base-url", process.env.BASE_URL || "http://localhost:6608") || "").replace(/\/$/, "");
const username = getArg("--username", process.env.ADMIN_USERNAME || "admin");
const password = getArg("--password", process.env.ADMIN_PASSWORD || "");
const reportPath = getArg(
  "--report-path",
  path.resolve(process.cwd(), "test-results/pythonlab/debug-smoke-report.json"),
);
const screenshotsDir = getArg(
  "--screenshots-dir",
  path.resolve(process.cwd(), "test-results/pythonlab/screenshots"),
);
const debugPauseTimeoutMs = Number(getArg("--debug-pause-timeout-ms", process.env.DEBUG_PAUSE_TIMEOUT_MS || "90000")) || 90000;
const requestedScenarioIds = new Set(
  getArgs("--scenario")
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean),
);

if (!password) {
  console.error("missing ADMIN_PASSWORD");
  process.exit(2);
}

ensureDir(path.dirname(reportPath));
resetDir(screenshotsDir);

async function login(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  try {
    await page.goto(`${baseUrl}/login?redirect=${encodeURIComponent("/admin/dashboard")}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const userInput = page.locator('input[name="username"], #username').first();
    const passwordInput = page.locator('input[name="password"], #password').first();
    await userInput.fill(username);
    await passwordInput.fill(password);

    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 }),
      page.locator("form").first().evaluate((form) => form.requestSubmit()),
    ]);
    await page.waitForTimeout(1000);

    return {
      status: "PASS",
      finalUrl: page.url(),
      diagnostics,
    };
  } catch (error) {
    return {
      status: "FAIL",
      finalUrl: page.url(),
      error: String(error),
      diagnostics,
    };
  } finally {
    await page.close();
  }
}

async function openSeqBasic(page) {
  await page.goto(`${baseUrl}/it-technology/python-lab/seq_basic`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForFunction(() => !!document.querySelector(".monaco-editor"), undefined, { timeout: 15_000 });
  await page.waitForTimeout(1500);
}

async function apiRequest(page, apiPath, { method = "GET", json = null } = {}) {
  return await page.evaluate(
    async ({ apiPath: targetPath, requestMethod, requestBody }) => {
      const response = await fetch(targetPath, {
        method: requestMethod,
        credentials: "include",
        headers: requestBody ? { "Content-Type": "application/json" } : undefined,
        body: requestBody ?? undefined,
      });
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      return {
        ok: response.ok,
        status: response.status,
        data,
      };
    },
    {
      apiPath,
      requestMethod: method,
      requestBody: json == null ? null : JSON.stringify(json),
    },
  );
}

async function cleanupOwnSessions(page) {
  const cleanup = await apiRequest(page, "/api/v2/pythonlab/sessions/cleanup", { method: "POST" });
  if (!cleanup.ok) {
    throw new Error(`session cleanup failed: ${cleanup.status}`);
  }
  const stoppedCount = Number(cleanup.data?.stopped_count || 0);

  let listed = await apiRequest(page, "/api/v2/pythonlab/sessions");
  const deadline = Date.now() + 5_000;
  while (listed.ok && Array.isArray(listed.data?.items) && listed.data.items.length > 0 && Date.now() < deadline) {
    await page.waitForTimeout(250);
    listed = await apiRequest(page, "/api/v2/pythonlab/sessions");
  }

  if (!listed.ok) {
    throw new Error(`session list failed after cleanup: ${listed.status}`);
  }
  if (Array.isArray(listed.data?.items) && listed.data.items.length > 0) {
    const remaining = listed.data.items.map((item) => `${item.session_id}:${item.status}`).join(", ");
    throw new Error(`session cleanup incomplete: ${remaining}`);
  }

  if (stoppedCount > 0) {
    await page.waitForTimeout(16_000);
  }
}

async function setBreakpoint(page, lineNumber = 2) {
  const lineRow = page
    .locator(".monaco-editor .margin-view-overlays > div")
    .filter({ has: page.locator(".line-numbers", { hasText: String(lineNumber) }) })
    .first();
  await lineRow.waitFor({ state: "visible", timeout: 5000 });
  await lineRow.click({ position: { x: 5, y: 9 } });
  await page.locator(".wsMonacoBp").first().waitFor({ state: "visible", timeout: 5000 });
}

async function clickRunnerButton(page, iconClass, options = {}) {
  const { which = "first", viaJs = false, force = false, noWaitAfter = false } = options;
  const buttons = page.locator("button").filter({ has: page.locator(`svg.${iconClass}`) });
  const button = which === "last" ? buttons.last() : buttons.first();
  if (viaJs) {
    await button.evaluate((node) => node.click());
    return;
  }
  await button.click({ force, noWaitAfter });
}

async function setEditorCode(page, nextCode) {
  const appliedByModel = await page.evaluate((code) => {
    if (typeof window.__pythonlabMonacoSetValue === "function") {
      window.__pythonlabMonacoSetValue(String(code));
      return true;
    }

    const monacoApi = window.monaco;
    const models = monacoApi?.editor?.getModels?.();
    if (Array.isArray(models) && models.length > 0 && typeof models[0]?.setValue === "function") {
      models[0].setValue(String(code));
      return true;
    }
    return false;
  }, nextCode);

  if (appliedByModel) {
    await page.waitForTimeout(100);
    return;
  }

  const viewLines = page.locator(".monaco-editor .view-lines").first();
  await viewLines.click({ position: { x: 80, y: 10 } });
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(nextCode, { delay: 20 });
}

async function readButtonState(page, iconClass) {
  return await page.locator("button").filter({ has: page.locator(`svg.${iconClass}`) }).first().evaluate((button) => {
    return {
      disabled: button.disabled,
      svgClass: button.querySelector("svg")?.getAttribute("class") || null,
    };
  });
}

async function collectPauseSnapshot(page) {
  return await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tr"))
      .map((tr) => (tr.textContent || "").trim())
      .filter(Boolean);
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
      text: (el.textContent || "").trim(),
      selected: el.getAttribute("aria-selected"),
    }));
    const activeLine = Array.from(document.querySelectorAll(".monaco-editor .active-line-number"))
      .map((el) => (el.textContent || "").trim())
      .find(Boolean);
    return {
      rows,
      tabs,
      activeLine: activeLine || null,
      bodyText: document.body.innerText,
    };
  });
}

async function readRunnerHookSnapshot(page) {
  return await page.evaluate(() => {
    return window.__pythonlabRunnerSnapshot || null;
  });
}

async function waitForRunnerHookState(page, predicate, timeout = debugPauseTimeoutMs) {
  const deadline = Date.now() + timeout;
  let lastSnapshot = null;
  while (Date.now() < deadline) {
    try {
      const snapshot = await readRunnerHookSnapshot(page);
      lastSnapshot = snapshot;
      if (snapshot && predicate(snapshot)) {
        return snapshot;
      }
    } catch {}
    await page.waitForTimeout(100);
  }
  throw new Error(`runner hook timeout: ${JSON.stringify({ lastSnapshot })}`);
}

async function waitForPauseSnapshot(page, predicate, timeout = debugPauseTimeoutMs) {
  const deadline = Date.now() + timeout;
  let lastSnapshot = null;
  let lastContinueState = null;

  while (Date.now() < deadline) {
    try {
      const snapshot = await collectPauseSnapshot(page);
      const continueState = await readButtonState(page, "lucide-fast-forward");
      lastSnapshot = snapshot;
      lastContinueState = continueState;

      const debugSelected = snapshot.tabs.some((tab) => tab.text.includes("调试器") && tab.selected === "true");
      if (debugSelected && continueState.disabled === false && predicate(snapshot)) {
        return snapshot;
      }
    } catch {}

    await page.waitForTimeout(250);
  }

  throw new Error(
    `pause snapshot timeout: ${JSON.stringify({
      lastSnapshot,
      lastContinueState,
    })}`,
  );
}

async function collectTerminalSnapshot(page) {
  return await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
      text: (el.textContent || "").trim(),
      selected: el.getAttribute("aria-selected"),
    }));
    const xtermRows = Array.from(document.querySelectorAll(".xterm-rows > div"))
      .map((row) => (row.textContent || "").replace(/\u00a0/g, " ").trimEnd())
      .filter((row) => row.trim().length > 0);
    return {
      tabs,
      xtermRows,
      bodyText: document.body.innerText,
    };
  });
}

async function selectPanelTab(page, label) {
  const tab = page.getByRole("tab", { name: label }).first();
  await tab.click();
  await page.waitForFunction((expectedLabel) => {
    return Array.from(document.querySelectorAll('[role="tab"]')).some((el) => {
      return (el.textContent || "").trim() === expectedLabel && el.getAttribute("aria-selected") === "true";
    });
  }, label, { timeout: 5000 });
}

async function waitForDebugPause(page, matcher, timeout = debugPauseTimeoutMs) {
  await page.waitForFunction((expected) => {
    const debugTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => (el.textContent || "").includes("调试器"),
    );
    const rows = Array.from(document.querySelectorAll("table tr"))
      .map((tr) => (tr.textContent || "").trim())
      .filter(Boolean);
    const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.querySelector("svg.lucide-fast-forward"),
    );
    return (
      debugTab?.getAttribute("aria-selected") === "true" &&
      rows.some((text) => text.includes(expected)) &&
      Boolean(continueButton) &&
      continueButton.disabled === false
    );
  }, matcher, { timeout });
}

async function waitForDebugPauseState(
  page,
  { includeRows = [], excludeRows = [], bodyIncludes = [] } = {},
  timeout = debugPauseTimeoutMs,
) {
  await page.waitForFunction(({ expectedRows, forbiddenRows, expectedBodyIncludes }) => {
    const debugTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => (el.textContent || "").includes("调试器"),
    );
    const rows = Array.from(document.querySelectorAll("table tr"))
      .map((tr) => (tr.textContent || "").trim())
      .filter(Boolean);
    const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.querySelector("svg.lucide-fast-forward"),
    );
    const bodyText = document.body.innerText || "";
    return (
      debugTab?.getAttribute("aria-selected") === "true" &&
      Boolean(continueButton) &&
      continueButton.disabled === false &&
      expectedRows.every((fragment) => rows.some((text) => text.includes(fragment))) &&
      forbiddenRows.every((fragment) => rows.every((text) => !text.includes(fragment))) &&
      expectedBodyIncludes.every((fragment) => bodyText.includes(fragment))
    );
  }, {
    expectedRows: includeRows,
    forbiddenRows: excludeRows,
    expectedBodyIncludes: bodyIncludes,
  }, { timeout });
}

async function waitForTerminalOutputAndIdle(page, expectedRow, timeout = 15_000) {
  await page.waitForFunction((expected) => {
    const rows = Array.from(document.querySelectorAll(".xterm-rows > div"))
      .map((row) => (row.textContent || "").replace(/\u00a0/g, " ").trim())
      .filter(Boolean);
    const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.querySelector("svg.lucide-fast-forward"),
    );
    const playButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.querySelector("svg.lucide-circle-play"),
    );
    const hasSpinner = Boolean(document.querySelector("svg.lucide-loader-circle"));
    return (
      rows.includes(expected) &&
      Boolean(continueButton) &&
      Boolean(playButton) &&
      continueButton.disabled === true &&
      playButton.disabled === false &&
      !hasSpinner
    );
  }, expectedRow, { timeout });
}

async function waitForOwnSessionsToDrain(page, timeout = 10_000) {
  let sessions = await listOwnSessions(page);
  const deadline = Date.now() + timeout;
  while (sessions.length > 0 && Date.now() < deadline) {
    await page.waitForTimeout(250);
    sessions = await listOwnSessions(page);
  }
  return sessions;
}

async function listOwnSessions(page) {
  const listed = await apiRequest(page, "/api/v2/pythonlab/sessions");
  if (!listed.ok) {
    throw new Error(`session list failed: ${listed.status}`);
  }
  return Array.isArray(listed.data?.items) ? listed.data.items : [];
}

async function getLatestOwnSessionId(page) {
  const items = await listOwnSessions(page);
  if (items.length <= 0) {
    throw new Error("expected at least one session");
  }
  return String(items[0].session_id || "");
}

async function openTakeoverSocket(page, sessionId) {
  return await page.evaluate(async ({ sid }) => {
    const readCookieToken = () => {
      const raw = document.cookie || "";
      const pairs = raw.split(";").map((item) => item.trim()).filter(Boolean);
      for (const pair of pairs) {
        const idx = pair.indexOf("=");
        if (idx <= 0) continue;
        const key = pair.slice(0, idx);
        const value = pair.slice(idx + 1);
        if (key === "ws_access_token" || key === "access_token") {
          return decodeURIComponent(value);
        }
      }
      return null;
    };

    const storedToken =
      window.localStorage.getItem("ws_access_token") ||
      window.sessionStorage.getItem("ws_access_token") ||
      readCookieToken();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const clientConnId = `smoke_takeover_${Date.now().toString(36)}`;
    const base = `${protocol}//${window.location.host}/api/v2/pythonlab/sessions/${encodeURIComponent(sid)}/ws?client_conn_id=${encodeURIComponent(clientConnId)}`;
    const url = storedToken ? `${base}&token=${encodeURIComponent(storedToken)}` : base;

    const socket = new WebSocket(url);
    window.__pythonlabTakeoverSocket = socket;

    return await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error("takeover socket open timeout"));
      }, 5000);
      socket.onopen = () => {
        window.clearTimeout(timer);
        resolve({ clientConnId, usedToken: Boolean(storedToken) });
      };
      socket.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("takeover socket open failed"));
      };
    });
  }, { sid: sessionId });
}

async function closeTakeoverSocket(page) {
  try {
    await page.evaluate(() => {
      const socket = window.__pythonlabTakeoverSocket;
      if (socket) {
        try {
          socket.close(1000, "smoke_cleanup");
        } catch {}
      }
      delete window.__pythonlabTakeoverSocket;
    });
  } catch {}
}

async function runPlainHappyPathScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-run-happy");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await clickRunnerButton(page, "lucide-circle-play");

    await page.waitForFunction(() => {
      const playButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-circle-play"),
      );
      const rows = Array.from(document.querySelectorAll(".xterm-rows > div"))
        .map((row) => (row.textContent || "").replace(/\u00a0/g, " ").trim())
        .filter(Boolean);
      return Boolean(playButton) && playButton.disabled === false && rows.includes("8");
    }, undefined, { timeout: 30_000 });

    const snapshot = await collectTerminalSnapshot(page);
    const playState = await readButtonState(page, "lucide-circle-play");
    const bugState = await readButtonState(page, "lucide-bug");
    const sessions = await listOwnSessions(page);
    const shot = `${screenshotPrefix}.png`;
    await page.screenshot({ path: shot, fullPage: true });

    if (sessions.length > 0) {
      throw new Error(`plain run unexpectedly created remote sessions: ${sessions.map((item) => item.session_id).join(", ")}`);
    }

    return {
      id: "run-happy-path",
      status: "PASS",
      snapshot,
      playState,
      bugState,
      remoteSessionCount: sessions.length,
      screenshots: [shot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "run-happy-path",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runPlainInputRemoteScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-run-input-remote");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setEditorCode(page, "name = input()\nprint(name)\n");
    await page.waitForTimeout(1000);
    await clickRunnerButton(page, "lucide-circle-play");

    await page.waitForFunction(async () => {
      const resp = await fetch("/api/v2/pythonlab/sessions", { credentials: "include" });
      if (!resp.ok) return false;
      const data = await resp.json();
      return Array.isArray(data.items) && data.items.length > 0;
    }, undefined, { timeout: 30_000 });

    await page.waitForFunction(() => Boolean(document.querySelector(".xterm")), undefined, { timeout: 15_000 });
    await page.locator(".xterm").first().click({ position: { x: 120, y: 20 } });
    await page.keyboard.type("hello", { delay: 20 });
    await page.keyboard.press("Enter");

    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll(".xterm-rows > div"))
        .map((row) => (row.textContent || "").replace(/\u00a0/g, " ").trim())
        .filter(Boolean);
      const playButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-circle-play"),
      );
      return rows.includes("hello") && Boolean(playButton) && playButton.disabled === false;
    }, undefined, { timeout: 30_000 });

    const snapshot = await collectTerminalSnapshot(page);
    const playState = await readButtonState(page, "lucide-circle-play");
    const bugState = await readButtonState(page, "lucide-bug");
    const sessions = await listOwnSessions(page);
    const shot = `${screenshotPrefix}.png`;
    await page.screenshot({ path: shot, fullPage: true });

    return {
      id: "run-input-remote-path",
      status: "PASS",
      snapshot,
      playState,
      bugState,
      remainingRemoteSessionCount: sessions.length,
      screenshots: [shot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "run-input-remote-path",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function installPythonlabWsFaultInjector(page) {
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    if (!NativeWebSocket || window.__pythonlabWsFaultInjectorInstalled) return;

    class PythonlabFaultWebSocket extends NativeWebSocket {
      constructor(url, protocols) {
        super(url, protocols);
        const href = String(url || "");
        if (href.includes("/api/v2/pythonlab/sessions/") && href.includes("/ws") && !href.includes("/terminal")) {
          window.__pythonlabFaultSocket = this;
          window.__pythonlabForceClose = ({ code = 4401, reason = "" } = {}) => {
            if (window.__pythonlabFaultSocket !== this) return false;
            const handler = this.onclose;
            this.onclose = null;
            if (typeof handler === "function") {
              handler.call(this, {
                code,
                reason,
                wasClean: false,
                target: this,
                currentTarget: this,
              });
            }
            try {
              this.close(1000, "fault_injected");
            } catch {}
            return true;
          };
        }
      }
    }

    Object.defineProperty(PythonlabFaultWebSocket, "CONNECTING", { value: NativeWebSocket.CONNECTING });
    Object.defineProperty(PythonlabFaultWebSocket, "OPEN", { value: NativeWebSocket.OPEN });
    Object.defineProperty(PythonlabFaultWebSocket, "CLOSING", { value: NativeWebSocket.CLOSING });
    Object.defineProperty(PythonlabFaultWebSocket, "CLOSED", { value: NativeWebSocket.CLOSED });

    window.WebSocket = PythonlabFaultWebSocket;
    window.__pythonlabWsFaultInjectorInstalled = true;
  });
}

async function forcePythonlabSocketClose(page, { code, reason = "" }) {
  return await page.evaluate(({ closeCode, closeReason }) => {
    if (typeof window.__pythonlabForceClose !== "function") {
      throw new Error("pythonlab force close hook missing");
    }
    const ok = window.__pythonlabForceClose({ code: closeCode, reason: closeReason });
    if (!ok) {
      throw new Error("pythonlab force close rejected");
    }
    return true;
  }, { closeCode: code, closeReason: reason });
}

async function runHappyPathScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-happy");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setBreakpoint(page, 2);
    await clickRunnerButton(page, "lucide-bug");

    await page.waitForFunction(() => {
      const debugTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
        (el) => (el.textContent || "").includes("调试器"),
      );
      const rows = Array.from(document.querySelectorAll("table tr"))
        .map((tr) => (tr.textContent || "").trim())
        .filter(Boolean);
      const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-fast-forward"),
      );
      return (
        debugTab?.getAttribute("aria-selected") === "true" &&
        rows.some((text) => text.includes("a") && text.includes("3")) &&
        Boolean(continueButton) &&
        continueButton.disabled === false
      );
    }, undefined, { timeout: debugPauseTimeoutMs });

    const paused = await collectPauseSnapshot(page);
    const pausedShot = `${screenshotPrefix}-paused.png`;
    await page.screenshot({ path: pausedShot, fullPage: true });

    await clickRunnerButton(page, "lucide-fast-forward");
    await page.waitForFunction(() => {
      const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-fast-forward"),
      );
      return (
        Boolean(continueButton) &&
        continueButton.disabled === true &&
        document.body.innerText.includes("暂无变量")
      );
    }, undefined, { timeout: 15_000 });

    const finished = await page.evaluate(() => ({
      bodyText: document.body.innerText,
      tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
        text: (el.textContent || "").trim(),
        selected: el.getAttribute("aria-selected"),
      })),
    }));
    const playState = await readButtonState(page, "lucide-circle-play");
    const continueState = await readButtonState(page, "lucide-fast-forward");
    const doneShot = `${screenshotPrefix}-finished.png`;
    await page.screenshot({ path: doneShot, fullPage: true });

    return {
      id: "debug-happy-path",
      status: "PASS",
      paused,
      finished,
      playState,
      continueState,
      screenshots: [pausedShot, doneShot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-happy-path",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runMultiBreakpointContinueScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-multi-breakpoint-continue");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setEditorCode(page, "a = 1\nb = 2\nc = a + b\nd = c * 2\ne = d - 1\nprint(e)\n");
    await page.waitForTimeout(1000);
    await setBreakpoint(page, 2);
    await setBreakpoint(page, 4);
    await setBreakpoint(page, 6);
    await clickRunnerButton(page, "lucide-bug");

    await waitForDebugPause(page, "a1int");
    const firstPause = await collectPauseSnapshot(page);
    const firstShot = `${screenshotPrefix}-first-pause.png`;
    await page.screenshot({ path: firstShot, fullPage: true });
    if (!firstPause.rows.some((text) => text.includes("a1int"))) {
      throw new Error(`first breakpoint variables mismatch: ${JSON.stringify(firstPause.rows)}`);
    }

    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForDebugPause(page, "c3int", 15_000);
    const secondPause = await collectPauseSnapshot(page);
    const secondShot = `${screenshotPrefix}-second-pause.png`;
    await page.screenshot({ path: secondShot, fullPage: true });
    if (!secondPause.rows.some((text) => text.includes("c3int"))) {
      throw new Error(`second breakpoint variables mismatch: ${JSON.stringify(secondPause.rows)}`);
    }

    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForDebugPause(page, "e5int", 15_000);
    const thirdPause = await collectPauseSnapshot(page);
    const thirdShot = `${screenshotPrefix}-third-pause.png`;
    await page.screenshot({ path: thirdShot, fullPage: true });
    if (!thirdPause.rows.some((text) => text.includes("e5int"))) {
      throw new Error(`third breakpoint variables mismatch: ${JSON.stringify(thirdPause.rows)}`);
    }

    await selectPanelTab(page, "终端交互");
    await page.waitForFunction(() => Boolean(document.querySelector(".xterm")), undefined, { timeout: 5000 });
    await clickRunnerButton(page, "lucide-fast-forward");
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll(".xterm-rows > div"))
        .map((row) => (row.textContent || "").replace(/\u00a0/g, " ").trim())
        .filter(Boolean);
      const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-fast-forward"),
      );
      const playButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-circle-play"),
      );
      const hasSpinner = Boolean(document.querySelector("svg.lucide-loader-circle"));
      return (
        rows.includes("5") &&
        Boolean(continueButton) &&
        Boolean(playButton) &&
        continueButton.disabled === true &&
        playButton.disabled === false &&
        !hasSpinner
      );
    }, undefined, { timeout: 15_000 });

    const terminal = await collectTerminalSnapshot(page);
    const playState = await readButtonState(page, "lucide-circle-play");
    const continueState = await readButtonState(page, "lucide-fast-forward");
    let sessions = await listOwnSessions(page);
    const sessionsDeadline = Date.now() + 10_000;
    while (sessions.length > 0 && Date.now() < sessionsDeadline) {
      await page.waitForTimeout(250);
      sessions = await listOwnSessions(page);
    }
    const doneShot = `${screenshotPrefix}-done.png`;
    await page.screenshot({ path: doneShot, fullPage: true });

    if (sessions.length > 0) {
      throw new Error(`debug sessions still active after completion: ${sessions.map((item) => `${item.session_id}:${item.status}`).join(", ")}`);
    }

    return {
      id: "debug-multi-breakpoint-continue-to-end",
      status: "PASS",
      firstPause,
      secondPause,
      thirdPause,
      terminal,
      playState,
      continueState,
      remoteSessionCountAfterFinish: sessions.length,
      screenshots: [firstShot, secondShot, thirdShot, doneShot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-multi-breakpoint-continue-to-end",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runLoopBreakpointContinueScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-loop-breakpoint-continue");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setEditorCode(page, "i = 0\ntotal = 0\nwhile i < 3:\n    total += i\n    i += 1\ndouble_total = total * 2\nprint(double_total)\n");
    await page.waitForTimeout(1000);
    await setBreakpoint(page, 4);
    await setBreakpoint(page, 6);
    await setBreakpoint(page, 7);
    await clickRunnerButton(page, "lucide-bug");

    await waitForDebugPause(page, "i0int");
    const firstPause = await collectPauseSnapshot(page);
    const firstShot = `${screenshotPrefix}-first-pause.png`;
    await page.screenshot({ path: firstShot, fullPage: true });
    if (!firstPause.rows.some((text) => text.includes("i0int")) || !firstPause.rows.some((text) => text.includes("total0int"))) {
      throw new Error(`loop first pause mismatch: ${JSON.stringify(firstPause.rows)}`);
    }

    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForDebugPause(page, "i1int", 15_000);
    const secondPause = await collectPauseSnapshot(page);
    const secondShot = `${screenshotPrefix}-second-pause.png`;
    await page.screenshot({ path: secondShot, fullPage: true });
    if (!secondPause.rows.some((text) => text.includes("i1int")) || !secondPause.rows.some((text) => text.includes("total0int"))) {
      throw new Error(`loop second pause mismatch: ${JSON.stringify(secondPause.rows)}`);
    }

    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForDebugPause(page, "i2int", 15_000);
    const thirdPause = await collectPauseSnapshot(page);
    const thirdShot = `${screenshotPrefix}-third-pause.png`;
    await page.screenshot({ path: thirdShot, fullPage: true });
    if (!thirdPause.rows.some((text) => text.includes("i2int")) || !thirdPause.rows.some((text) => text.includes("total1int"))) {
      throw new Error(`loop third pause mismatch: ${JSON.stringify(thirdPause.rows)}`);
    }

    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForDebugPause(page, "total3int", 15_000);
    const fourthPause = await collectPauseSnapshot(page);
    const fourthShot = `${screenshotPrefix}-fourth-pause.png`;
    await page.screenshot({ path: fourthShot, fullPage: true });
    if (!fourthPause.rows.some((text) => text.includes("total3int"))) {
      throw new Error(`loop fourth pause mismatch: ${JSON.stringify(fourthPause.rows)}`);
    }

    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForDebugPause(page, "double_total6int", 15_000);
    const fifthPause = await collectPauseSnapshot(page);
    const fifthShot = `${screenshotPrefix}-fifth-pause.png`;
    await page.screenshot({ path: fifthShot, fullPage: true });
    if (!fifthPause.rows.some((text) => text.includes("double_total6int"))) {
      throw new Error(`loop fifth pause mismatch: ${JSON.stringify(fifthPause.rows)}`);
    }

    await selectPanelTab(page, "终端交互");
    await page.waitForFunction(() => Boolean(document.querySelector(".xterm")), undefined, { timeout: 5000 });
    await clickRunnerButton(page, "lucide-fast-forward");
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll(".xterm-rows > div"))
        .map((row) => (row.textContent || "").replace(/\u00a0/g, " ").trim())
        .filter(Boolean);
      const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-fast-forward"),
      );
      const playButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-circle-play"),
      );
      const hasSpinner = Boolean(document.querySelector("svg.lucide-loader-circle"));
      return (
        rows.includes("6") &&
        Boolean(continueButton) &&
        Boolean(playButton) &&
        continueButton.disabled === true &&
        playButton.disabled === false &&
        !hasSpinner
      );
    }, undefined, { timeout: 15_000 });

    const terminal = await collectTerminalSnapshot(page);
    const playState = await readButtonState(page, "lucide-circle-play");
    const continueState = await readButtonState(page, "lucide-fast-forward");
    let sessions = await listOwnSessions(page);
    const sessionsDeadline = Date.now() + 10_000;
    while (sessions.length > 0 && Date.now() < sessionsDeadline) {
      await page.waitForTimeout(250);
      sessions = await listOwnSessions(page);
    }
    const doneShot = `${screenshotPrefix}-done.png`;
    await page.screenshot({ path: doneShot, fullPage: true });

    if (sessions.length > 0) {
      throw new Error(`loop debug sessions still active after completion: ${sessions.map((item) => `${item.session_id}:${item.status}`).join(", ")}`);
    }

    return {
      id: "debug-loop-breakpoint-continue-to-end",
      status: "PASS",
      firstPause,
      secondPause,
      thirdPause,
      fourthPause,
      fifthPause,
      terminal,
      playState,
      continueState,
      remoteSessionCountAfterFinish: sessions.length,
      screenshots: [firstShot, secondShot, thirdShot, fourthShot, fifthShot, doneShot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-loop-breakpoint-continue-to-end",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runStepOverScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-step-over");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setEditorCode(
      page,
      "def add_one(v):\n    temp = v + 1\n    return temp\nvalue = 1\nresult = add_one(value)\nfinal = result * 2\nprint(final)\n",
    );
    await page.waitForTimeout(1000);
    await setBreakpoint(page, 5);
    await clickRunnerButton(page, "lucide-bug");

    await waitForDebugPauseState(page, {
      includeRows: ["value1int"],
      excludeRows: ["result2int", "v1int"],
      bodyIncludes: ["result = add_one(value)"],
    });
    const firstPause = await collectPauseSnapshot(page);
    const firstShot = `${screenshotPrefix}-first-pause.png`;
    await page.screenshot({ path: firstShot, fullPage: true });

    const stepOverStateBefore = await readButtonState(page, "lucide-chevron-right");
    if (stepOverStateBefore.disabled) {
      throw new Error("step over control was disabled at paused call site");
    }

    await clickRunnerButton(page, "lucide-chevron-right");
    await waitForDebugPauseState(page, {
      includeRows: ["value1int", "result2int"],
      excludeRows: ["v1int"],
      bodyIncludes: ["final = result * 2"],
    }, 15_000);
    const steppedPause = await collectPauseSnapshot(page);
    const steppedShot = `${screenshotPrefix}-stepped-pause.png`;
    await page.screenshot({ path: steppedShot, fullPage: true });

    if (steppedPause.rows.some((text) => text.includes("v1int"))) {
      throw new Error(`step over entered callee unexpectedly: ${JSON.stringify(steppedPause.rows)}`);
    }

    await selectPanelTab(page, "终端交互");
    await page.waitForFunction(() => Boolean(document.querySelector(".xterm")), undefined, { timeout: 5000 });
    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForTerminalOutputAndIdle(page, "4");

    const terminal = await collectTerminalSnapshot(page);
    const playState = await readButtonState(page, "lucide-circle-play");
    const continueState = await readButtonState(page, "lucide-fast-forward");
    const stepOverStateAfter = await readButtonState(page, "lucide-chevron-right");
    const sessions = await waitForOwnSessionsToDrain(page);
    const doneShot = `${screenshotPrefix}-done.png`;
    await page.screenshot({ path: doneShot, fullPage: true });

    if (sessions.length > 0) {
      throw new Error(`step over sessions still active after completion: ${sessions.map((item) => `${item.session_id}:${item.status}`).join(", ")}`);
    }

    return {
      id: "debug-step-over-to-end",
      status: "PASS",
      firstPause,
      steppedPause,
      terminal,
      playState,
      continueState,
      stepOverStateBefore,
      stepOverStateAfter,
      remoteSessionCountAfterFinish: sessions.length,
      screenshots: [firstShot, steppedShot, doneShot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-step-over-to-end",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runStepIntoOutScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-step-into-out");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setEditorCode(
      page,
      "def add_one(v):\n    temp = v + 1\n    return temp\nvalue = 1\nresult = add_one(value)\nfinal = result * 2\nprint(final)\n",
    );
    await page.waitForTimeout(1000);
    await setBreakpoint(page, 5);
    await clickRunnerButton(page, "lucide-bug");

    await waitForDebugPauseState(page, {
      includeRows: ["value1int"],
      excludeRows: ["result2int", "v1int"],
      bodyIncludes: ["result = add_one(value)"],
    });
    const firstPause = await collectPauseSnapshot(page);
    const firstShot = `${screenshotPrefix}-first-pause.png`;
    await page.screenshot({ path: firstShot, fullPage: true });

    const stepIntoStateBefore = await readButtonState(page, "lucide-log-in");
    const stepOutStateBefore = await readButtonState(page, "lucide-log-out");
    if (stepIntoStateBefore.disabled || stepOutStateBefore.disabled) {
      throw new Error("step into/out controls were disabled at paused call site");
    }

    await clickRunnerButton(page, "lucide-log-in");
    await waitForDebugPauseState(page, {
      includeRows: ["v1int"],
      excludeRows: ["result2int"],
      bodyIncludes: ["temp = v + 1"],
    }, 15_000);
    const insidePause = await collectPauseSnapshot(page);
    const insideShot = `${screenshotPrefix}-inside-callee.png`;
    await page.screenshot({ path: insideShot, fullPage: true });

    await clickRunnerButton(page, "lucide-log-out");
    await waitForDebugPauseState(page, {
      includeRows: ["value1int"],
      excludeRows: ["v1int"],
      bodyIncludes: ["result = add_one(value)"],
    }, 15_000);
    const afterStepOutPause = await collectPauseSnapshot(page);
    const outShot = `${screenshotPrefix}-after-step-out.png`;
    await page.screenshot({ path: outShot, fullPage: true });

    if (!insidePause.rows.some((text) => text.includes("v1int"))) {
      throw new Error(`step into did not expose callee locals: ${JSON.stringify(insidePause.rows)}`);
    }
    if (afterStepOutPause.rows.some((text) => text.includes("v1int"))) {
      throw new Error(`step out did not return to caller scope: ${JSON.stringify(afterStepOutPause.rows)}`);
    }

    await clickRunnerButton(page, "lucide-chevron-right");
    await waitForDebugPauseState(page, {
      includeRows: ["value1int", "result2int"],
      excludeRows: ["v1int"],
      bodyIncludes: ["final = result * 2"],
    }, 15_000);
    const afterReturnStepOverPause = await collectPauseSnapshot(page);
    const returnStepShot = `${screenshotPrefix}-after-return-step-over.png`;
    await page.screenshot({ path: returnStepShot, fullPage: true });

    await selectPanelTab(page, "终端交互");
    await page.waitForFunction(() => Boolean(document.querySelector(".xterm")), undefined, { timeout: 5000 });
    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForTerminalOutputAndIdle(page, "4");

    const terminal = await collectTerminalSnapshot(page);
    const playState = await readButtonState(page, "lucide-circle-play");
    const continueState = await readButtonState(page, "lucide-fast-forward");
    const stepIntoStateAfter = await readButtonState(page, "lucide-log-in");
    const stepOutStateAfter = await readButtonState(page, "lucide-log-out");
    const sessions = await waitForOwnSessionsToDrain(page);
    const doneShot = `${screenshotPrefix}-done.png`;
    await page.screenshot({ path: doneShot, fullPage: true });

    if (sessions.length > 0) {
      throw new Error(`step into/out sessions still active after completion: ${sessions.map((item) => `${item.session_id}:${item.status}`).join(", ")}`);
    }

    return {
      id: "debug-step-into-step-out-to-end",
      status: "PASS",
      firstPause,
      insidePause,
      afterStepOutPause,
      afterReturnStepOverPause,
      terminal,
      playState,
      continueState,
      stepIntoStateBefore,
      stepOutStateBefore,
      stepIntoStateAfter,
      stepOutStateAfter,
      remoteSessionCountAfterFinish: sessions.length,
      screenshots: [firstShot, insideShot, outShot, returnStepShot, doneShot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-step-into-step-out-to-end",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runPauseResumeScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-pause-resume");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setEditorCode(
      page,
      "import time\ni = 0\nwhile i < 50:\n    i += 1\n    time.sleep(0.05)\nprint(i)\n",
    );
    await page.waitForTimeout(1000);
    await setBreakpoint(page, 2);
    await clickRunnerButton(page, "lucide-bug");

    const firstPauseHook = await waitForRunnerHookState(
      page,
      (snapshot) =>
        snapshot.status === "paused" &&
        Array.isArray(snapshot.variables) &&
        snapshot.variables.some((item) => item.name === "time" && item.type === "module"),
      20_000,
    );
    const firstPause = await waitForPauseSnapshot(
      page,
      (snapshot) => snapshot.rows.some((text) => text.startsWith("time") && text.endsWith("module")),
      20_000,
    );
    const firstShot = `${screenshotPrefix}-first-pause.png`;
    await page.screenshot({ path: firstShot, fullPage: true });

    await clickRunnerButton(page, "lucide-fast-forward");
    const runningState = await waitForRunnerHookState(page, (snapshot) => snapshot.status === "running", 10_000);

    await page.waitForTimeout(400);
    await clickRunnerButton(page, "lucide-circle-pause");
    const pausedHook = await waitForRunnerHookState(
      page,
      (snapshot) =>
        snapshot.status === "paused" &&
        Array.isArray(snapshot.variables) &&
        snapshot.variables.some((item) => item.name === "i" && Number(item.value) >= 1),
      20_000,
    );
    const resumedPause = await waitForPauseSnapshot(
      page,
      (snapshot) => snapshot.rows.some((text) => /^i[1-9]\d*int$/.test(text)),
      20_000,
    );
    const pauseShot = `${screenshotPrefix}-after-pause.png`;
    await page.screenshot({ path: pauseShot, fullPage: true });

    const loopValueRow = resumedPause.rows.find((text) => /^i\d+int$/.test(text)) || null;
    if (!loopValueRow || loopValueRow === "i0int") {
      throw new Error(`pause did not stop after loop advanced: ${JSON.stringify(resumedPause.rows)}`);
    }

    await selectPanelTab(page, "终端交互");
    await page.waitForFunction(() => Boolean(document.querySelector(".xterm")), undefined, { timeout: 5000 });
    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForTerminalOutputAndIdle(page, "50", 20_000);

    const terminal = await collectTerminalSnapshot(page);
    const playState = await readButtonState(page, "lucide-circle-play");
    const pauseState = await readButtonState(page, "lucide-circle-pause");
    const continueState = await readButtonState(page, "lucide-fast-forward");
    const sessions = await waitForOwnSessionsToDrain(page);
    const doneShot = `${screenshotPrefix}-done.png`;
    await page.screenshot({ path: doneShot, fullPage: true });

    if (sessions.length > 0) {
      throw new Error(`pause/resume sessions still active after completion: ${sessions.map((item) => `${item.session_id}:${item.status}`).join(", ")}`);
    }

    return {
      id: "debug-pause-resume-to-end",
      status: "PASS",
      firstPause,
      firstPauseHook,
      runningState,
      pausedHook,
      resumedPause,
      terminal,
      playState,
      pauseState,
      continueState,
      remoteSessionCountAfterFinish: sessions.length,
      screenshots: [firstShot, pauseShot, doneShot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-pause-resume-to-end",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runResetRestartScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-reset-restart");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setEditorCode(page, "a = 1\nb = 2\nc = a + b\nprint(c)\n");
    await page.waitForTimeout(1000);
    await setBreakpoint(page, 2);
    await clickRunnerButton(page, "lucide-bug");

    await waitForDebugPauseState(page, {
      includeRows: ["a1int"],
      bodyIncludes: ["b = 2"],
    });
    const firstPause = await collectPauseSnapshot(page);
    const firstShot = `${screenshotPrefix}-first-pause.png`;
    await page.screenshot({ path: firstShot, fullPage: true });

    await clickRunnerButton(page, "lucide-refresh-cw", { which: "last", viaJs: true });
    await page.waitForFunction(() => {
      const playButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-circle-play"),
      );
      const bugButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-bug"),
      );
      const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-fast-forward"),
      );
      const hasSpinner = Boolean(document.querySelector("svg.lucide-loader-circle"));
      const bodyText = document.body.innerText || "";
      return (
        bodyText.includes("暂无变量") &&
        Boolean(playButton) &&
        Boolean(bugButton) &&
        Boolean(continueButton) &&
        playButton.disabled === false &&
        bugButton.disabled === false &&
        continueButton.disabled === true &&
        !hasSpinner
      );
    }, undefined, { timeout: 20_000 });

    const afterReset = await page.evaluate(() => ({
      bodyText: document.body.innerText,
      tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
        text: (el.textContent || "").trim(),
        selected: el.getAttribute("aria-selected"),
      })),
    }));
    const resetShot = `${screenshotPrefix}-after-reset.png`;
    await page.screenshot({ path: resetShot, fullPage: true });

    let sessions = await waitForOwnSessionsToDrain(page);
    if (sessions.length > 0) {
      throw new Error(`reset did not clear active sessions: ${sessions.map((item) => `${item.session_id}:${item.status}`).join(", ")}`);
    }

    await clickRunnerButton(page, "lucide-bug");
    await waitForDebugPauseState(page, {
      includeRows: ["a1int"],
      bodyIncludes: ["b = 2"],
    }, 20_000);
    const secondPause = await collectPauseSnapshot(page);
    const restartShot = `${screenshotPrefix}-second-pause.png`;
    await page.screenshot({ path: restartShot, fullPage: true });

    await selectPanelTab(page, "终端交互");
    await page.waitForFunction(() => Boolean(document.querySelector(".xterm")), undefined, { timeout: 5000 });
    await clickRunnerButton(page, "lucide-fast-forward");
    await waitForTerminalOutputAndIdle(page, "3", 20_000);

    const terminal = await collectTerminalSnapshot(page);
    const playState = await readButtonState(page, "lucide-circle-play");
    const continueState = await readButtonState(page, "lucide-fast-forward");
    sessions = await waitForOwnSessionsToDrain(page);
    const doneShot = `${screenshotPrefix}-done.png`;
    await page.screenshot({ path: doneShot, fullPage: true });

    if (sessions.length > 0) {
      throw new Error(`reset/restart sessions still active after completion: ${sessions.map((item) => `${item.session_id}:${item.status}`).join(", ")}`);
    }

    return {
      id: "debug-reset-restart-to-end",
      status: "PASS",
      firstPause,
      afterReset,
      secondPause,
      terminal,
      playState,
      continueState,
      remoteSessionCountAfterFinish: sessions.length,
      screenshots: [firstShot, resetShot, restartShot, doneShot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-reset-restart-to-end",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runSessionTakenOverScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-session-taken-over");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setBreakpoint(page, 2);
    await clickRunnerButton(page, "lucide-bug");

    await page.waitForFunction(() => {
      const debugTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
        (el) => (el.textContent || "").includes("调试器"),
      );
      const rows = Array.from(document.querySelectorAll("table tr"))
        .map((tr) => (tr.textContent || "").trim())
        .filter(Boolean);
      return debugTab?.getAttribute("aria-selected") === "true" && rows.some((text) => text.includes("a") && text.includes("3"));
    }, undefined, { timeout: debugPauseTimeoutMs });

    const sessionId = await getLatestOwnSessionId(page);
    await openTakeoverSocket(page, sessionId);

    await page.waitForFunction(() => {
      const bodyText = document.body.innerText;
      const playButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-circle-play"),
      );
      const bugButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-bug"),
      );
      const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-fast-forward"),
      );
      const hasSpinner = Boolean(document.querySelector("svg.lucide-loader-circle"));
      return (
        bodyText.includes("当前调试会话已被新窗口接管") &&
        Boolean(playButton) &&
        Boolean(bugButton) &&
        Boolean(continueButton) &&
        playButton.disabled === false &&
        bugButton.disabled === false &&
        continueButton.disabled === true &&
        !hasSpinner
      );
    }, undefined, { timeout: 15_000 });

    const snapshot = await page.evaluate(() => ({
      bodyText: document.body.innerText,
      tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
        text: (el.textContent || "").trim(),
        selected: el.getAttribute("aria-selected"),
      })),
    }));
    const playState = await readButtonState(page, "lucide-circle-play");
    const bugState = await readButtonState(page, "lucide-bug");
    const continueState = await readButtonState(page, "lucide-fast-forward");
    const shot = `${screenshotPrefix}.png`;
    await page.screenshot({ path: shot, fullPage: true });

    return {
      id: "debug-session-taken-over",
      status: "PASS",
      snapshot,
      playState,
      bugState,
      continueState,
      screenshots: [shot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-session-taken-over",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    await closeTakeoverSocket(page);
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runAuthExpiredCloseScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-auth-expired-close");

  try {
    await installPythonlabWsFaultInjector(page);
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setBreakpoint(page, 2);
    await clickRunnerButton(page, "lucide-bug");

    await page.waitForFunction(() => {
      const debugTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
        (el) => (el.textContent || "").includes("调试器"),
      );
      const rows = Array.from(document.querySelectorAll("table tr"))
        .map((tr) => (tr.textContent || "").trim())
        .filter(Boolean);
      return debugTab?.getAttribute("aria-selected") === "true" && rows.some((text) => text.includes("a") && text.includes("3"));
    }, undefined, { timeout: debugPauseTimeoutMs });

    await forcePythonlabSocketClose(page, { code: 4401, reason: "" });

    await page.waitForFunction(() => {
      const bodyText = document.body.innerText;
      const playButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-circle-play"),
      );
      const bugButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-bug"),
      );
      const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-fast-forward"),
      );
      const hasSpinner = Boolean(document.querySelector("svg.lucide-loader-circle"));
      return (
        bodyText.includes("登录已过期，请刷新页面") &&
        Boolean(playButton) &&
        Boolean(bugButton) &&
        Boolean(continueButton) &&
        playButton.disabled === false &&
        bugButton.disabled === false &&
        continueButton.disabled === true &&
        !hasSpinner
      );
    }, undefined, { timeout: 10_000 });

    const snapshot = await page.evaluate(() => ({
      bodyText: document.body.innerText,
      tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
        text: (el.textContent || "").trim(),
        selected: el.getAttribute("aria-selected"),
      })),
    }));
    const playState = await readButtonState(page, "lucide-circle-play");
    const bugState = await readButtonState(page, "lucide-bug");
    const continueState = await readButtonState(page, "lucide-fast-forward");
    const shot = `${screenshotPrefix}.png`;
    await page.screenshot({ path: shot, fullPage: true });

    return {
      id: "debug-auth-expired-close",
      status: "PASS",
      snapshot,
      playState,
      bugState,
      continueState,
      screenshots: [shot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-auth-expired-close",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runTransientReconnectScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-transient-reconnect");
  let debugWsCount = 0;

  page.on("websocket", (ws) => {
    const url = ws.url();
    if (url.includes("/api/v2/pythonlab/sessions/") && url.includes("/ws") && !url.includes("/terminal")) {
      debugWsCount += 1;
    }
  });

  try {
    await installPythonlabWsFaultInjector(page);
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await setBreakpoint(page, 2);
    await clickRunnerButton(page, "lucide-bug");

    await page.waitForFunction(() => {
      const debugTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
        (el) => (el.textContent || "").includes("调试器"),
      );
      const rows = Array.from(document.querySelectorAll("table tr"))
        .map((tr) => (tr.textContent || "").trim())
        .filter(Boolean);
      const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-fast-forward"),
      );
      return (
        debugTab?.getAttribute("aria-selected") === "true" &&
        rows.some((text) => text.includes("a") && text.includes("3")) &&
        Boolean(continueButton) &&
        continueButton.disabled === false
      );
    }, undefined, { timeout: debugPauseTimeoutMs });

    const pausedBeforeReconnect = await collectPauseSnapshot(page);
    await forcePythonlabSocketClose(page, { code: 1006, reason: "" });
    const reconnectDeadline = Date.now() + 10_000;
    while (debugWsCount < 2 && Date.now() < reconnectDeadline) {
      await page.waitForTimeout(250);
    }

    await clickRunnerButton(page, "lucide-fast-forward");
    await page.waitForFunction(() => {
      const continueButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-fast-forward"),
      );
      return (
        Boolean(continueButton) &&
        continueButton.disabled === true &&
        document.body.innerText.includes("暂无变量")
      );
    }, undefined, { timeout: 15_000 });

    const finished = await page.evaluate(() => ({
      bodyText: document.body.innerText,
      tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
        text: (el.textContent || "").trim(),
        selected: el.getAttribute("aria-selected"),
      })),
    }));
    const continueState = await readButtonState(page, "lucide-fast-forward");
    const playState = await readButtonState(page, "lucide-circle-play");
    const shot = `${screenshotPrefix}.png`;
    await page.screenshot({ path: shot, fullPage: true });

    if (debugWsCount < 2) {
      throw new Error(`expected reconnect websocket, saw ${debugWsCount}`);
    }

    return {
      id: "debug-transient-close-reconnect",
      status: "PASS",
      debugWsCount,
      pausedBeforeReconnect,
      finished,
      playState,
      continueState,
      screenshots: [shot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-transient-close-reconnect",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      debugWsCount,
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runSessionCreateHttpFailureScenario(context, scenario) {
  const {
    id,
    status,
    responseBody,
    expectedText,
    screenshotStem,
  } = scenario;
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, screenshotStem);

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await page.route(
      "**/api/v2/pythonlab/sessions",
      async (route) => {
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(responseBody),
        });
      },
      { times: 1 },
    );
    await setBreakpoint(page, 2);
    await clickRunnerButton(page, "lucide-bug");

    await page.waitForFunction((message) => {
      const bodyText = document.body.innerText;
      const bugButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-bug"),
      );
      const hasSpinner = Boolean(document.querySelector("svg.lucide-loader-circle"));
      return (
        bodyText.includes(message) &&
        Boolean(bugButton) &&
        bugButton.disabled === false &&
        !hasSpinner
      );
    }, expectedText, { timeout: 10_000 });

    const snapshot = await page.evaluate(() => ({
      bodyText: document.body.innerText,
      tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
        text: (el.textContent || "").trim(),
        selected: el.getAttribute("aria-selected"),
      })),
    }));
    const playState = await readButtonState(page, "lucide-circle-play");
    const bugState = await readButtonState(page, "lucide-bug");
    const shot = `${screenshotPrefix}.png`;
    await page.screenshot({ path: shot, fullPage: true });

    return {
      id,
      status: "PASS",
      snapshot,
      playState,
      bugState,
      screenshots: [shot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id,
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function runSessionLostScenario(context) {
  const page = await context.newPage();
  const diagnostics = await attachDiagnostics(page);
  const screenshotPrefix = path.join(screenshotsDir, "pythonlab-debug-session-lost");

  try {
    await openSeqBasic(page);
    await cleanupOwnSessions(page);
    await page.route(
      "**/api/v2/pythonlab/sessions/*",
      async (route) => {
        if (route.request().method() !== "GET") {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "synthetic session lost during bootstrap" }),
        });
      },
      { times: 1 },
    );
    await setBreakpoint(page, 2);
    await clickRunnerButton(page, "lucide-bug");

    await page.waitForFunction(() => {
      const bodyText = document.body.innerText;
      const bugButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-bug"),
      );
      const playButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.querySelector("svg.lucide-circle-play"),
      );
      const hasSpinner = Boolean(document.querySelector("svg.lucide-loader-circle"));
      return (
        bodyText.includes("会话不存在/已被清理，可点右侧会话查看后重试") &&
        Boolean(bugButton) &&
        Boolean(playButton) &&
        bugButton.disabled === false &&
        playButton.disabled === false &&
        !hasSpinner
      );
    }, undefined, { timeout: 15_000 });

    const snapshot = await page.evaluate(() => ({
      bodyText: document.body.innerText,
      tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
        text: (el.textContent || "").trim(),
        selected: el.getAttribute("aria-selected"),
      })),
    }));
    const playState = await readButtonState(page, "lucide-circle-play");
    const bugState = await readButtonState(page, "lucide-bug");
    const shot = `${screenshotPrefix}.png`;
    await page.screenshot({ path: shot, fullPage: true });

    return {
      id: "debug-session-lost-during-bootstrap",
      status: "PASS",
      snapshot,
      playState,
      bugState,
      screenshots: [shot],
      diagnostics,
    };
  } catch (error) {
    const failShot = `${screenshotPrefix}-failed.png`;
    try {
      await page.screenshot({ path: failShot, fullPage: true });
    } catch {}
    return {
      id: "debug-session-lost-during-bootstrap",
      status: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      screenshots: [failShot],
      diagnostics,
    };
  } finally {
    try {
      await cleanupOwnSessions(page);
    } catch {}
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 960 },
    ignoreHTTPSErrors: true,
  });

  const report = {
    generatedAt: nowIso(),
    baseUrl,
    requestedScenarios: [...requestedScenarioIds],
    login: null,
    scenarios: [],
    summary: {
      total: 0,
      pass: 0,
      fail: 0,
    },
  };

  try {
    report.login = await login(context);
    if (report.login.status !== "PASS") {
      throw new Error(`login failed: ${report.login.error || report.login.finalUrl || "unknown error"}`);
    }

    const scenarioEntries = [
      { id: "run-happy-path", enabledByDefault: true, run: () => runPlainHappyPathScenario(context) },
      { id: "run-input-remote-path", enabledByDefault: true, run: () => runPlainInputRemoteScenario(context) },
      { id: "debug-happy-path", enabledByDefault: true, run: () => runHappyPathScenario(context) },
      { id: "debug-multi-breakpoint-continue-to-end", enabledByDefault: true, run: () => runMultiBreakpointContinueScenario(context) },
      { id: "debug-loop-breakpoint-continue-to-end", enabledByDefault: true, run: () => runLoopBreakpointContinueScenario(context) },
      { id: "debug-pause-resume-to-end", enabledByDefault: true, run: () => runPauseResumeScenario(context) },
      { id: "debug-step-over-to-end", enabledByDefault: true, run: () => runStepOverScenario(context) },
      { id: "debug-step-into-step-out-to-end", enabledByDefault: true, run: () => runStepIntoOutScenario(context) },
      { id: "debug-reset-restart-to-end", enabledByDefault: true, run: () => runResetRestartScenario(context) },
      { id: "debug-session-taken-over", enabledByDefault: true, run: () => runSessionTakenOverScenario(context) },
      { id: "debug-auth-expired-close", enabledByDefault: true, run: () => runAuthExpiredCloseScenario(context) },
      { id: "debug-transient-close-reconnect", enabledByDefault: true, run: () => runTransientReconnectScenario(context) },
      { id: "debug-session-lost-during-bootstrap", enabledByDefault: true, run: () => runSessionLostScenario(context) },
      {
        id: "debug-session-create-quota-exceeded",
        enabledByDefault: true,
        run: () => runSessionCreateHttpFailureScenario(context, {
          id: "debug-session-create-quota-exceeded",
          status: 429,
          responseBody: {
            detail: {
              error_code: "QUOTA_EXCEEDED",
              message: "并发调试会话数已达上限",
            },
          },
          expectedText: "Request failed with status code 429",
          screenshotStem: "pythonlab-debug-session-create-quota-exceeded",
        }),
      },
      {
        id: "debug-session-create-failure",
        enabledByDefault: true,
        run: () => runSessionCreateHttpFailureScenario(context, {
          id: "debug-session-create-failure",
          status: 500,
          responseBody: { detail: "synthetic session create failure" },
          expectedText: "Request failed with status code 500",
          screenshotStem: "pythonlab-debug-session-create-failure",
        }),
      },
    ];

    const knownScenarioIds = new Set(scenarioEntries.map((entry) => entry.id));
    const unknownScenarioIds = [...requestedScenarioIds].filter((id) => !knownScenarioIds.has(id));
    if (unknownScenarioIds.length > 0) {
      throw new Error(`unknown scenario ids: ${unknownScenarioIds.join(", ")}`);
    }

    for (const entry of scenarioEntries) {
      if (requestedScenarioIds.size > 0 && !requestedScenarioIds.has(entry.id)) {
        continue;
      }
      if (requestedScenarioIds.size === 0 && entry.enabledByDefault === false) {
        continue;
      }
      report.scenarios.push(await entry.run());
    }
  } finally {
    await context.close();
    await browser.close();
  }

  report.summary.total = report.scenarios.length;
  report.summary.pass = report.scenarios.filter((item) => item.status === "PASS").length;
  report.summary.fail = report.scenarios.filter((item) => item.status === "FAIL").length;

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`PythonLab smoke report written to ${reportPath}`);
  console.log(`Screenshots written to ${screenshotsDir}`);

  if (report.summary.fail > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
