const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:6608";
const STUDENT_USER = "张三";
const STUDENT_PASS = "2026212";
const ADMIN_USER = "admin";
const ADMIN_PASS = "wangshuhao0727";
const EXECUTABLE = "/root/.cache/ms-playwright/chromium-1217/chrome-linux/chrome";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureLoggedOut(page) {
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  const userButton = page.locator("header .header-right").getByText(/未登录|学生|管理员|超级管理员|张三|admin/i).first();
  if (await userButton.count()) {
    await userButton.click({ force: true }).catch(() => {});
    const logout = page.getByText("退出登录").first();
    if (await logout.count()) {
      await logout.click({ force: true }).catch(() => {});
      await page.waitForLoadState("networkidle");
    }
  }
}

async function openLoginModal(page) {
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  const loginEntry = page.getByText("未登录").first();
  if (await loginEntry.count()) {
    await loginEntry.click({ force: true });
  } else {
    const avatar = page.locator("header .header-right [title='点击登录']").first();
    await avatar.click({ force: true });
  }
  await page.locator("#username").waitFor({ state: "visible", timeout: 15000 });
}

async function loginViaModal(page, username, password) {
  await openLoginModal(page);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /登 录|登录/ }).last().click();
  await page.waitForLoadState("networkidle");
  await sleep(2500);
}

async function getBodyText(page) {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ["--no-sandbox"] });
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxC = await browser.newContext();
  const ctxAdmin = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const pageC = await ctxC.newPage();
  const adminPage = await ctxAdmin.newPage();

  const results = [];

  try {
    await ensureLoggedOut(pageA);
    await ensureLoggedOut(pageB);
    await ensureLoggedOut(pageC);
    await ensureLoggedOut(adminPage);

    await loginViaModal(pageA, STUDENT_USER, STUDENT_PASS);
    await pageA.goto(`${BASE}/it-technology/python-lab`, { waitUntil: "networkidle" });
    await sleep(2500);
    const beforeKickText = await getBodyText(pageA);
    results.push({ name: "student_single_device_pythonlab", pass: /PythonLab|调试|运行|代码/.test(beforeKickText), sample: beforeKickText.slice(0, 200) });

    await loginViaModal(pageB, STUDENT_USER, STUDENT_PASS);
    await pageA.reload({ waitUntil: "networkidle" });
    await sleep(2500);
    const kickedText = await getBodyText(pageA);
    const oldDeviceShowsLoggedOut = kickedText.includes("未登录");

    const loginEntry = pageA.getByText("未登录").first();
    if (await loginEntry.count()) {
      await loginEntry.click({ force: true });
      await sleep(1200);
    }
    const afterClickText = await getBodyText(pageA);
    const strongKickMessage = afterClickText.includes("你的账号已在其他地方登录，当前设备已下线，请重新登录");
    results.push({ name: "student_relogin_kicks_old_device", pass: oldDeviceShowsLoggedOut && strongKickMessage, sample: afterClickText.slice(0, 240) });

    await pageC.goto(`${BASE}/home`, { waitUntil: "networkidle" });
    await pageC.evaluate(() => {
      try {
        localStorage.setItem("ws_access_token", "expired-token-for-ui-check");
        sessionStorage.setItem("ws_access_token", "expired-token-for-ui-check");
        localStorage.removeItem("ws_refresh_token");
        sessionStorage.removeItem("ws_refresh_token");
      } catch {}
    });
    await pageC.reload({ waitUntil: "networkidle" });
    await sleep(2500);
    const expiredText = await getBodyText(pageC);
    const notMisclassified = !expiredText.includes("其他地方登录");
    results.push({ name: "expired_session_not_misclassified_as_replaced", pass: notMisclassified, sample: expiredText.slice(0, 200) });

    await loginViaModal(adminPage, ADMIN_USER, ADMIN_PASS);
    await adminPage.goto(`${BASE}/home`, { waitUntil: "networkidle" });
    await sleep(1500);
    const adminText = await getBodyText(adminPage);
    const adminOk = adminText.includes("管理员") || adminText.includes("超级管理员") || adminText.includes("admin");
    results.push({ name: "admin_login_still_works", pass: adminOk, sample: adminText.slice(0, 200) });

    console.log(JSON.stringify({ results }, null, 2));
    process.exit(results.some((r) => !r.pass) ? 1 : 0);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
