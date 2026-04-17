import fs from "fs";
import path from "path";
import { chromium } from "playwright";

function getArg(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const baseUrl = (getArg("--base-url", process.env.BASE_URL || "http://localhost:6608") || "").replace(/\/$/, "");
const username = getArg("--username", process.env.ADMIN_USERNAME || "admin");
const password = getArg("--password", process.env.ADMIN_PASSWORD || "");
const expectedReason = getArg(
  "--expected-reason",
  "你的账号已在其他地方登录，当前设备已下线，请重新登录",
);
const reportPath = getArg(
  "--report-path",
  path.resolve(process.cwd(), "test-results/prod-smoke/auth-replaced-login-results.json"),
);
const screenshotsDir = getArg(
  "--screenshots-dir",
  path.resolve(process.cwd(), "test-results/prod-smoke/screenshots/auth-replaced-login"),
);

if (!password) {
  console.error("missing ADMIN_PASSWORD");
  process.exit(2);
}

ensureDir(path.dirname(reportPath));
ensureDir(screenshotsDir);

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
    if (response.status() >= 500) {
      diagnostics.badResponses.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
      });
    }
  });
  return diagnostics;
}

async function installAuthTrace(context) {
  await context.addInitScript(() => {
    window.__authExpiredEvents = [];
    window.addEventListener("ws:auth-expired", (event) => {
      window.__authExpiredEvents.push({
        detail: event.detail || null,
        at: Date.now(),
      });
    });
  });
}

async function login(page) {
  await page.goto(`${baseUrl}/login?redirect=${encodeURIComponent("/admin/dashboard")}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.locator('input[name="username"], #username').first().fill(username);
  await page.locator('input[name="password"], #password').first().fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.getByRole("button", { name: /登录/ }).click(),
  ]);
  await page.waitForTimeout(1200);
}

async function triggerOldDeviceAuthCheck(page) {
  await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    try {
      await fetch("/api/v1/auth/me", { credentials: "include" });
    } catch {
    }
  });
}

async function collectAuthReplayState(page) {
  return await page.evaluate(() => {
    const readStorage = (key) => {
      try {
        return sessionStorage.getItem(key) || localStorage.getItem(key) || null;
      } catch {
        return null;
      }
    };
    return {
      url: window.location.href,
      bodyText: document.body.innerText || "",
      authExpiredEvents: window.__authExpiredEvents || [],
      lastAuthExpiredDetail: window.__wsLastAuthExpiredDetail || null,
      persistedReason: readStorage("ws_auth_expired_detail"),
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const oldContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const newContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await installAuthTrace(oldContext);

  const oldPage = await oldContext.newPage();
  const newPage = await newContext.newPage();
  const report = {
    baseUrl,
    expectedReason,
    status: "PASS",
    oldDevice: {},
    newDevice: {},
    diagnostics: {
      old: await attachDiagnostics(oldPage),
      new: await attachDiagnostics(newPage),
    },
  };

  try {
    await login(oldPage);
    report.oldDevice.afterInitialLoginUrl = oldPage.url();
    await oldPage.screenshot({ path: path.join(screenshotsDir, "old-after-login.png"), fullPage: true });

    await login(newPage);
    report.newDevice.afterReplacementLoginUrl = newPage.url();
    await newPage.screenshot({ path: path.join(screenshotsDir, "new-after-login.png"), fullPage: true });

    await triggerOldDeviceAuthCheck(oldPage);
    await oldPage.waitForFunction(
      ({ reason }) => {
        const text = document.body.innerText || "";
        const detail = window.__wsLastAuthExpiredDetail;
        const events = window.__authExpiredEvents || [];
        const persisted = (() => {
          try {
            return sessionStorage.getItem("ws_auth_expired_detail") || localStorage.getItem("ws_auth_expired_detail") || "";
          } catch {
            return "";
          }
        })();
        const hasReason = text.includes(reason) || persisted.includes(reason) || detail?.reason?.includes(reason) || events.some((event) => event?.detail?.reason?.includes(reason));
        const loggedOut = window.location.pathname.startsWith("/login") || text.includes("未登录") || text.includes("登录");
        return loggedOut && hasReason;
      },
      { reason: expectedReason },
      { timeout: 20_000 },
    );

    const state = await collectAuthReplayState(oldPage);
    report.oldDevice.final = {
      url: state.url,
      reasonVisible: state.bodyText.includes(expectedReason),
      lastAuthExpiredDetail: state.lastAuthExpiredDetail,
      persistedReason: state.persistedReason,
      authExpiredEvents: state.authExpiredEvents,
      bodyExcerpt: state.bodyText.slice(0, 1200),
    };
    if (!state.bodyText.includes(expectedReason)) {
      report.status = "FAIL";
      report.failure = "expected reason was replayable but not visible in page body";
    }
  } catch (error) {
    report.status = "FAIL";
    report.failure = String(error);
    try {
      const state = await collectAuthReplayState(oldPage);
      report.oldDevice.final = {
        url: state.url,
        reasonVisible: state.bodyText.includes(expectedReason),
        lastAuthExpiredDetail: state.lastAuthExpiredDetail,
        persistedReason: state.persistedReason,
        authExpiredEvents: state.authExpiredEvents,
        bodyExcerpt: state.bodyText.slice(0, 1200),
      };
    } catch {
    }
  } finally {
    try {
      await oldPage.screenshot({ path: path.join(screenshotsDir, "old-final.png"), fullPage: true });
    } catch {
    }
    try {
      await newPage.screenshot({ path: path.join(screenshotsDir, "new-final.png"), fullPage: true });
    } catch {
    }
    await oldContext.close();
    await newContext.close();
    await browser.close();
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`Auth replaced-login smoke report written to ${reportPath}`);
  console.log(`Screenshots written to ${screenshotsDir}`);
  if (report.status !== "PASS") process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
