import { test, expect } from "@playwright/test";

test("no horizontal overflow at 1920×1080", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/display");
  await page.waitForLoadState("networkidle");

  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const clientWidth = await page.evaluate(() => document.body.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
});

test("metrics panel not clipped at 4K", async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto("/display");
  await page.waitForLoadState("networkidle");

  const metPanel = page.locator("#dpmet");
  await expect(metPanel).toBeVisible();
  const box = await metPanel.boundingBox();
  expect(box?.width).toBeGreaterThan(200);
});

test("queue list scrolls when content overflows", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/display");
  await page.waitForLoadState("networkidle");

  const queueList = page.locator("#dqlist");
  const overflowY = await queueList.evaluate(el => getComputedStyle(el).overflowY);
  // should be auto or scroll to allow scrolling
  expect(["auto", "scroll"]).toContain(overflowY);
});
