import { test, expect } from "@playwright/test";

test.describe("API Health", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get("http://localhost:4000/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("public banners endpoint returns array", async ({ request }) => {
    const response = await request.get("http://localhost:4000/api/v1/banners");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test("public FAQ endpoint returns array", async ({ request }) => {
    const response = await request.get("http://localhost:4000/api/v1/faq");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test("competitions endpoint returns array", async ({ request }) => {
    const response = await request.get("http://localhost:4000/api/v1/competitions");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test("unauthenticated admin request returns 401", async ({ request }) => {
    const response = await request.get("http://localhost:4000/api/v1/admin/users");
    expect(response.status()).toBe(401);
  });

  test("rate limiter headers are present on login", async ({ request }) => {
    const response = await request.post("http://localhost:4000/api/v1/auth/login", {
      data: { email: "test@test.com", password: "wrong" },
    });
    expect(response.headers()["x-ratelimit-limit"]).toBeDefined();
    expect(response.headers()["x-ratelimit-remaining"]).toBeDefined();
  });
});
