import { expect, test } from "@playwright/test";

test("local previews do not load production analytics", async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("googletagmanager.com")) analyticsRequests.push(request.url());
  });

  await page.goto("/");

  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  expect(analyticsRequests).toEqual([]);
});

test("malformed request paths return a bad request response", async ({ request }) => {
  const response = await request.get("/%");
  expect(response.status()).toBe(400);
});

test("project filters show only the selected category", async ({ page }) => {
  await page.goto("/projects/");

  const cards = page.locator(".project-card");
  const microsoftCards = page.locator('.project-card[data-category="microsoft"]');
  const totalCount = await cards.count();
  const microsoftCount = await microsoftCards.count();

  await page.getByRole("button", { name: "Microsoft" }).click();
  await expect(page.locator(".project-card:visible")).toHaveCount(microsoftCount);
  await expect(microsoftCards).toHaveCount(microsoftCount);

  await page.getByRole("button", { name: "All" }).click();
  await expect(page.locator(".project-card:visible")).toHaveCount(totalCount);
});

test("citation feedback resets after repeated copy attempts", async ({ page }) => {
  await page.goto("/publications/");
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => undefined;
  });

  const button = page.locator(".citation-button");
  await button.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("Citation control is not an HTML element");
    element.click();
    element.click();
  });

  await expect(button).toHaveText("Copied");
  await expect(button).toHaveText("Copy citation", { timeout: 2_500 });
});

test("citation copy failures show temporary feedback", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/publications/");
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => Promise.reject(new Error("Clipboard unavailable"));
  });

  const button = page.locator(".citation-button");
  await button.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("Citation control is not an HTML element");
    element.click();
  });

  await expect(button).toHaveText("Copy failed");
  await expect(button).toHaveText("Copy citation", { timeout: 2_500 });
  expect(pageErrors).toEqual([]);
});
