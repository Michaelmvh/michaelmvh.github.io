import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { OtherSection } from "../scripts/types.ts";

const otherSections = JSON.parse(await fs.readFile("src/data/other.json", "utf8")) as OtherSection[];
const otherImages = otherSections.flatMap((section) => section.images);
const captionedImageIndex = otherImages.findIndex((image) => image.caption);
const uncaptionedImageIndex = otherImages.findIndex((image) => !image.caption);
const captionedImage = otherImages[captionedImageIndex];
const captionedImageCaption = captionedImage?.caption;
if (!captionedImage || !captionedImageCaption || uncaptionedImageIndex < 0) {
  throw new Error("Lightbox tests require captioned and uncaptioned Other page images");
}

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

test("Other page lightbox opens, clears captions, closes, and restores focus", async ({ page }) => {
  await page.goto("/other/");

  const captionedTrigger = page.locator("[data-lightbox-image]").nth(captionedImageIndex);
  await captionedTrigger.focus();
  await captionedTrigger.press("Enter");

  const lightbox = page.locator(".lightbox");
  await expect(lightbox).toBeVisible();
  await expect(lightbox.locator(".lightbox-image")).toHaveAttribute("alt", captionedImage.alt);
  await expect(lightbox.locator(".lightbox-caption")).toHaveText(captionedImageCaption);

  await page.keyboard.press("Escape");
  await expect(lightbox).not.toBeVisible();
  await expect(captionedTrigger).toBeFocused();

  const uncaptionedTrigger = page.locator("[data-lightbox-image]").nth(uncaptionedImageIndex);
  await uncaptionedTrigger.click();
  await expect(lightbox.locator(".lightbox-caption")).toBeHidden();
  await lightbox.locator(".lightbox-close").click();
  await expect(uncaptionedTrigger).toBeFocused();
});

test("Other page lightbox closes from the backdrop", async ({ page }) => {
  await page.goto("/other/");
  await page.locator("[data-lightbox-image]").first().click();

  const lightbox = page.locator(".lightbox");
  await expect(lightbox).toBeVisible();
  await page.mouse.click(1, 1);
  await expect(lightbox).not.toBeVisible();
});

test("Other page lightbox stays usable within the viewport", async ({ page }) => {
  await page.goto("/other/");

  const lightbox = page.locator(".lightbox");
  const image = lightbox.locator(".lightbox-image");
  const close = lightbox.locator(".lightbox-close");

  for (const imageIndex of [1, 2]) {
    await page.locator("[data-lightbox-image]").nth(imageIndex).click();
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate(
          (element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true);

    const viewport = page.viewportSize();
    const lightboxBox = await lightbox.boundingBox();
    const imageBox = await image.boundingBox();
    const closeBox = await close.boundingBox();
    expect(viewport).not.toBeNull();
    expect(lightboxBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(closeBox).not.toBeNull();
    if (!viewport || !lightboxBox || !imageBox || !closeBox) return;

    expect(lightboxBox.x).toBeGreaterThanOrEqual(0);
    expect(lightboxBox.y).toBeGreaterThanOrEqual(0);
    expect(lightboxBox.x + lightboxBox.width).toBeLessThanOrEqual(viewport.width);
    expect(lightboxBox.y + lightboxBox.height).toBeLessThanOrEqual(viewport.height);
    expect(imageBox.width).toBeLessThanOrEqual(viewport.width);
    expect(imageBox.height).toBeLessThanOrEqual(viewport.height);
    expect(closeBox.width).toBe(44);
    expect(closeBox.height).toBe(44);
    expect(closeBox.x).toBeGreaterThanOrEqual(0);
    expect(closeBox.y).toBeGreaterThanOrEqual(0);
    expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(viewport.width);
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(viewport.height);
    expect(boxesOverlap(closeBox, imageBox)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await close.click();
  }
});

test("Other page close control is stable while the large image loads", async ({ page }) => {
  let releaseImage: (() => void) | undefined;
  const imageReleased = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route("**/snail-by-log-1600.webp", async (route) => {
    await imageReleased;
    await route.continue();
  });
  await page.goto("/other/");
  await page.locator("[data-lightbox-image]").first().click();

  const close = page.locator(".lightbox-close");
  await expect(close).toBeVisible();
  const viewport = page.viewportSize();
  const closeBox = await close.boundingBox();
  expect(viewport).not.toBeNull();
  expect(closeBox).not.toBeNull();
  if (viewport && closeBox) {
    expect(closeBox.width).toBe(44);
    expect(closeBox.height).toBe(44);
    expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(viewport.width);
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(viewport.height);
  }

  releaseImage?.();
  await expect
    .poll(() =>
      page
        .locator(".lightbox-image")
        .evaluate(
          (element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
        ),
    )
    .toBe(true);
});

function boxesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}
