const { test, expect } = require('playwright/test');

test('smoke open login', async ({ page }) => {
  await page.goto('http://127.0.0.1:6608/login?redirect=%2Fai-agents', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login/);
});
