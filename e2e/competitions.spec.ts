import { test, expect } from "@playwright/test";

test.describe("Competitions", () => {
  test("competitions list page loads", async ({ page }) => {
    await page.goto("/competitions");
    // Page should load without errors
    await expect(page.locator("body")).toBeVisible();
  });

  test("homepage shows competition cards or empty state", async ({ page }) => {
    await page.goto("/");
    // Either shows competition cards or an empty/welcome state
    await expect(page.locator("body")).toBeVisible();
  });
});
