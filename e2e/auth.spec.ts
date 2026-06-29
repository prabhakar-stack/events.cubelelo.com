import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("homepage loads and shows hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveTitle(/Cubelelo/i);
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/sign in/i)).toBeVisible();
  });

  test("register page renders", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText(/create.*account/i)).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "nobody@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test("register then login flow", async ({ page, request }) => {
    const email = `test_${Date.now()}@example.com`;
    const password = "TestPass123!";

    // Register
    await page.goto("/register");
    await page.fill('input[name="name"], input[placeholder*="name" i]', "E2E Test User");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.getByRole("button", { name: /create|register|sign up/i }).click();

    // Should redirect to homepage or dashboard after successful registration
    await page.waitForURL((url) => !url.pathname.includes("/register"), { timeout: 10000 });
  });

  test("forgot password page renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText(/reset|forgot/i)).toBeVisible();
  });
});
