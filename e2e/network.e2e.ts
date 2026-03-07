import { test, expect } from "@playwright/test";

test.describe("Network panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/display");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("all resource cards have ship role badge", async ({ page }) => {
    const cards = page.locator(".dres-card");
    const count = await cards.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const badge = cards.nth(i).locator(".dtier");
        await expect(badge).toBeVisible();
        const text = await badge.textContent();
        expect(["CAPTAIN", "MATE", "CREW"]).toContain(text?.trim().toUpperCase());
      }
    }
  });

  test("status indicators have text label (ACTIVE/IDLE/OFFLINE)", async ({ page }) => {
    const cards = page.locator(".dres-card");
    const count = await cards.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const statusEl = cards.nth(i).locator(".dres-status");
        await expect(statusEl).toBeVisible();
        const text = await statusEl.textContent();
        expect(["ACTIVE", "IDLE", "OFFLINE"]).toContain(text?.trim().toUpperCase());
      }
    }
  });

  test("busy device has pulse animation class", async ({ page }) => {
    // Check that if any card is marked busy, its dot has ddot-busy class
    const busyCards = page.locator(".dres-card.busy");
    const count = await busyCards.count();
    if (count > 0) {
      const dot = busyCards.first().locator(".ddot");
      const classes = await dot.getAttribute("class");
      expect(classes).toContain("ddot-busy");
    }
  });
});
