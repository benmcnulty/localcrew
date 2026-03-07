import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { width: 1280, height: 720, label: "HD" },
  { width: 1920, height: 1080, label: "FHD" },
  { width: 2560, height: 1440, label: "QHD" },
  { width: 3840, height: 2160, label: "4K" },
];

for (const vp of VIEWPORTS) {
  test(`all panels visible at ${vp.label} (${vp.width}×${vp.height})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/display");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#dpnet")).toBeVisible();
    await expect(page.locator("#dpmain")).toBeVisible();
    await expect(page.locator("#dpmet")).toBeVisible();
  });

  test(`no horizontal overflow at ${vp.label}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/display");
    await page.waitForLoadState("networkidle");

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
  });

  test(`task text fits panel at ${vp.label}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/display");
    await page.waitForLoadState("networkidle");

    const taskEl = page.locator("#dtask");
    await expect(taskEl).toBeVisible();

    const taskBox = await taskEl.boundingBox();
    const panelBox = await page.locator("#dpmain").boundingBox();
    if (taskBox && panelBox) {
      expect(taskBox.x + taskBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 4);
    }
  });
}
