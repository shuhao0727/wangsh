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
const reportPath = getArg(
  "--report-path",
  path.resolve(process.cwd(), "test-results/prod-smoke/ui-results.json"),
);
const screenshotsDir = getArg(
  "--screenshots-dir",
  path.resolve(process.cwd(), "test-results/prod-smoke/screenshots"),
);

if (!password) {
  console.error("missing ADMIN_PASSWORD");
  process.exit(2);
}

ensureDir(path.dirname(reportPath));
ensureDir(screenshotsDir);

const routes = [
  { id: "admin-dashboard", path: "/admin/dashboard" },
  { id: "admin-system", path: "/admin/system" },
  { id: "admin-articles", path: "/admin/articles" },
  {
    id: "admin-article-editor-new",
    path: "/admin/articles/editor/new",
    action: async (page) => {
      const title = page.locator('input[placeholder*="标题"], input[name="title"], #title').first();
      if (await title.count()) {
        await title.fill(`smoke-ui-${Date.now()}`);
        return "fill-title";
      }
      return "skip-no-title-input";
    },
  },
  { id: "admin-informatics", path: "/admin/informatics" },
  {
    id: "admin-informatics-editor-new",
    path: "/admin/informatics/editor/new",
    action: async (page) => {
      const title = page.locator('input[placeholder*="标题"], input[name="title"], #title').first();
      if (await title.count()) {
        await title.fill(`smoke-note-${Date.now()}`);
        return "fill-title";
      }
      return "skip-no-title-input";
    },
  },
  { id: "xbk", path: "/xbk" },
  {
    id: "admin-it-technology",
    path: "/admin/it-technology",
    action: async (page) => {
      const manageBtn = page.getByRole("button", { name: "管理" }).first();
      if (await manageBtn.count()) {
        await manageBtn.click();
        await page.waitForTimeout(1000);
        return "click-manage";
      }
      return "skip-no-manage-button";
    },
  },
  { id: "admin-assessment", path: "/admin/assessment" },
  {
    id: "admin-assessment-editor-new",
    path: "/admin/assessment/editor/new",
    action: async (page) => {
      const title = page.locator('input[placeholder*="标题"], input[name="title"], #title').first();
      if (await title.count()) {
        await title.fill(`smoke-assessment-${Date.now()}`);
        return "fill-title";
      }
      return "skip-no-title-input";
    },
  },
  { id: "admin-classroom-interaction", path: "/admin/classroom-interaction" },
  { id: "admin-group-discussion", path: "/admin/group-discussion" },
  { id: "python-lab", path: "/it-technology/python-lab" },
];

async function login(context) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await page.goto(`${baseUrl}/login?redirect=${encodeURIComponent("/admin/dashboard")}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.getByRole("button", { name: /登录/ }).click(),
  ]);
  await page.waitForTimeout(1500);
  const finalUrl = page.url();
  await page.close();
  return { finalUrl, consoleErrors };
}

async function smokeRoute(context, route) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()?.errorText || "requestfailed",
    });
  });
  page.on("response", async (response) => {
    if (response.status() >= 500) {
      badResponses.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
      });
    }
  });

  const targetUrl = `${baseUrl}${route.path}`;
  let status = "PASS";
  let note = "";
  let action = "";
  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2500);

    if (new URL(page.url()).pathname.startsWith("/login")) {
      status = "FAIL";
      note = "unexpected redirect to login";
    } else {
      const bodyText = ((await page.locator("body").textContent()) || "").trim();
      if (!bodyText) {
        status = "FAIL";
        note = "blank body text";
      } else if (/404|Not Found|页面未找到/i.test(bodyText)) {
        status = "FAIL";
        note = "not found page";
      }
    }

    if (status !== "FAIL" && typeof route.action === "function") {
      action = await route.action(page);
      await page.waitForTimeout(1200);
    }

    if (status !== "FAIL" && (pageErrors.length > 0 || badResponses.length > 0)) {
      status = "FAIL";
      note = note || "page error or 5xx response detected";
    }

    if (status !== "FAIL" && consoleErrors.length > 0) {
      status = "WARN";
      note = note || "console error detected";
    }
  } catch (error) {
    status = "FAIL";
    note = String(error);
  }

  const screenshotPath = path.join(screenshotsDir, `${route.id}.png`);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {
    // ignore screenshot failure, result already captures page status
  }

  const result = {
    id: route.id,
    path: route.path,
    finalUrl: page.url(),
    status,
    note,
    action,
    screenshot: screenshotPath,
    consoleErrors,
    pageErrors,
    failedRequests,
    badResponses,
  };
  await page.close();
  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 960 },
    ignoreHTTPSErrors: true,
  });

  const report = {
    baseUrl,
    login: null,
    pages: [],
    summary: {
      total: 0,
      pass: 0,
      warn: 0,
      fail: 0,
    },
  };

  try {
    report.login = await login(context);
    for (const route of routes) {
      const result = await smokeRoute(context, route);
      report.pages.push(result);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  report.summary.total = report.pages.length;
  report.summary.pass = report.pages.filter((item) => item.status === "PASS").length;
  report.summary.warn = report.pages.filter((item) => item.status === "WARN").length;
  report.summary.fail = report.pages.filter((item) => item.status === "FAIL").length;

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`UI smoke report written to ${reportPath}`);
  console.log(`Screenshots written to ${screenshotsDir}`);
  if (report.summary.fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
