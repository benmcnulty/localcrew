import { test, expect } from "@playwright/test";

test.describe("Queue display", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/display");
    await page.waitForLoadState("networkidle");
    // Allow initial polling to complete
    await page.waitForTimeout(1500);
  });

  test("queue items never show {domain:X} prefix", async ({ page }) => {
    const queueItems = page.locator(".dqtext");
    const count = await queueItems.count();
    for (let i = 0; i < count; i++) {
      const text = await queueItems.nth(i).textContent();
      expect(text ?? "").not.toMatch(/^\{domain:[A-Z]+\}/i);
    }
  });

  test("active tasks have amber pulse indicator", async ({ page }) => {
    // If there are active task items, they should have the pulse dot
    const activeItems = page.locator(".dqitem-active");
    const count = await activeItems.count();
    if (count > 0) {
      const pulseDot = activeItems.first().locator(".dpulse");
      await expect(pulseDot).toBeVisible();
    }
  });

  test("current focus area does not duplicate active task text", async ({ page }) => {
    const activeItems = page.locator(".dqitem-active");
    const taskEl = page.locator("#dtask");
    const activeCount = await activeItems.count();

    if (activeCount > 0) {
      const taskText = await taskEl.textContent();
      // When tasks are active, #dtask should show "N task(s) in progress", not the task content
      expect(taskText ?? "").toMatch(/task.* in progress/i);
    }
  });
});
