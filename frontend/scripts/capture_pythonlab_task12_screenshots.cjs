const fs = require("fs");
const path = require("path");

async function main() {
  const { chromium } = require("playwright");
  const outputDir =
    process.argv[2] ||
    path.resolve(
      __dirname,
      "../../.trae/specs/rework-pythonlab-for-range-and-editor-ux/artifacts",
    );
  const baseUrl = process.argv[3] || "http://localhost:6608";
  const pagePath = process.argv[4] || "/it-technology/python-lab/loops";
  const targetUrl = new URL(pagePath, baseUrl).toString();

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1720, height: 980 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => {
    try {
      localStorage.setItem("python_lab_experiments", "[]");
      localStorage.removeItem("python_lab_last_experiment_id");
      sessionStorage.clear();
    } catch {}
  });
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000);

  const mainShot = path.join(outputDir, "task12-main-overview.png");
  await page.screenshot({ path: mainShot, fullPage: true });

  await page.getByRole("tab", { name: "参考" }).click();
  await page.getByText("完整流程图参考").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1000);

  const thumbShot = path.join(outputDir, "task12-thumbnail-overview.png");
  await page.screenshot({ path: thumbShot, fullPage: true });

  await page.getByRole("button", { name: "放大查看" }).click();
  await page.getByText("完整流程图（Graphviz）").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1000);

  const popupShot = path.join(outputDir, "task12-main-graphviz-popup.png");
  await page.screenshot({ path: popupShot, fullPage: true });

  const checks = [
    "for i in range(1, 10):",
    "_seq_i = list(range(1, 10))（循环开始）",
    "_it_i = iter(_seq_i)",
    "i = next(_it_i)（获取下一个元素）",
    "has_next(_it_i)?（循环结束判定）",
  ];
  const html = await page.content();
  const results = [];
  for (const text of checks) {
    const count = html.includes(text) ? 1 : 0;
    results.push({ text, count, pass: count > 0 });
  }

  const reportPath = path.join(outputDir, "task12-readability-report.md");
  const reportLines = [
    "# Task12 截图与可读性核对记录",
    "",
    `- 页面地址：${targetUrl}`,
    `- 主图截图：${mainShot}`,
    `- 缩略图截图：${thumbShot}`,
    `- 主图放大截图：${popupShot}`,
    "",
    "## 文案可读性核对",
  ];
  for (const item of results) {
    reportLines.push(
      `- [${item.pass ? "x" : " "}] ${item.text}（匹配次数：${item.count}）`,
    );
  }
  fs.writeFileSync(reportPath, reportLines.join("\n"), "utf-8");

  await context.close();
  await browser.close();

  console.log(`输出目录: ${outputDir}`);
  console.log(`主图截图: ${mainShot}`);
  console.log(`缩略图截图: ${thumbShot}`);
  console.log(`主图放大截图: ${popupShot}`);
  console.log(`核对报告: ${reportPath}`);
  for (const item of results) {
    console.log(`${item.pass ? "PASS" : "FAIL"}\t${item.count}\t${item.text}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
