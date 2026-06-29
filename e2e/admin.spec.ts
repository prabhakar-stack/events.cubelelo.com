import { test, expect, type Page } from "@playwright/test";

async function devLogin(page: Page): Promise<void> {
  // Use the API dev-login endpoint directly to get a token, then set it in localStorage
  const response = await page.request.post("http://localhost:4000/api/v1/auth/dev-login", {
    data: { email: "admin@cubelelo.com" },
  });
  const { token } = await response.json();

  await page.goto("/");
  await page.evaluate((t) => {
    localStorage.setItem("cubers_token", t);
  }, token);
  await page.reload();
}

test.describe("Admin Panel", () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  test("admin dashboard loads", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin users page loads", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByText(/users/i)).toBeVisible();
  });

  test("admin announcements page loads", async ({ page }) => {
    await page.goto("/admin/announcements");
    await expect(page.getByText(/announcements/i)).toBeVisible();
  });

  test("admin content (banners) page loads", async ({ page }) => {
    await page.goto("/admin/content");
    await expect(page.getByText(/banner/i)).toBeVisible();
  });

  test("admin FAQ page loads", async ({ page }) => {
    await page.goto("/admin/faq");
    await expect(page.getByText(/faq/i)).toBeVisible();
  });

  test("admin staff page loads", async ({ page }) => {
    await page.goto("/admin/staff");
    await expect(page.getByText(/staff/i)).toBeVisible();
  });

  test("create and delete a banner", async ({ page }) => {
    await page.goto("/admin/content");
    await page.getByRole("button", { name: /new banner/i }).click();
    await page.fill('input[placeholder*="title" i]', "E2E Test Banner");
    await page.getByRole("button", { name: /create/i }).click();

    await expect(page.getByText("E2E Test Banner")).toBeVisible({ timeout: 5000 });

    // Clean up
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /delete/i }).click();
    await expect(page.getByText("E2E Test Banner")).not.toBeVisible({ timeout: 5000 });
  });

  test("create and delete an FAQ entry", async ({ page }) => {
    await page.goto("/admin/faq");
    await page.getByRole("button", { name: /new faq/i }).click();
    await page.fill('input[placeholder*="how" i]', "E2E Test Question?");
    await page.fill('textarea', "E2E Test Answer in **markdown**.");
    await page.getByRole("button", { name: /create/i }).click();

    await expect(page.getByText("E2E Test Question?")).toBeVisible({ timeout: 5000 });

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /delete/i }).click();
    await expect(page.getByText("E2E Test Question?")).not.toBeVisible({ timeout: 5000 });
  });
});
