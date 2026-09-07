import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import type { NewsEntry, OtherSection, Pages, Project } from "../scripts/types.ts";

const otherSections = JSON.parse(await fs.readFile("src/data/other.json", "utf8")) as OtherSection[];
const otherImages = otherSections.flatMap((section) => section.images);
const projects = JSON.parse(await fs.readFile("src/data/projects.json", "utf8")) as Project[];
const news = JSON.parse(await fs.readFile("src/data/news.json", "utf8")) as NewsEntry[];
const pageCopy = JSON.parse(await fs.readFile("src/data/pages.json", "utf8")) as Pages;
const screenshotProjects = projects.filter((project) => project.screenshots?.length);
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

test.describe("homepage news without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("dated achievements remain readable at desktop and mobile sizes", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: pageCopy.home.newsHeading });
    if (news.length === 0) {
      await expect(section).toHaveCount(0);
      return;
    }
    await expect(section).toBeVisible();
    const entries = news.toSorted((left, right) => right.date.localeCompare(left.date));
    await expect(section.getByRole("listitem")).toHaveCount(entries.length);
    for (const [index, entry] of entries.entries()) {
      const row = section.getByRole("listitem").nth(index);
      await expect(row.locator("time")).toHaveAttribute("datetime", entry.date);
      await expect(row.locator("p")).toHaveText(entry.text);
      const bounds = await row.boundingBox();
      expect(bounds).not.toBeNull();
      if (!bounds) throw new Error("News entry has no visible bounds");
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
      expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
  });
});

test("malformed request paths return a bad request response", async ({ request }) => {
  const response = await request.get("/%");
  expect(response.status()).toBe(400);
});

test("local previews serve JPEG images with the correct media type", async ({ request }) => {
  const jpegImage = otherImages.find((image) => image.image.endsWith(".jpeg"));
  if (!jpegImage) throw new Error("Media type test requires a JPEG Other page image");

  const response = await request.get(jpegImage.image);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("image/jpeg");
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

for (const project of screenshotProjects) {
  test(`${project.slug}: screenshots load, enlarge with the keyboard, and restore focus`, async ({
    page,
  }) => {
    await page.goto(`/projects/${project.slug}/`);
    const figures = page.locator(".project-screenshot");
    await expect(figures).toHaveCount(project.screenshots?.length ?? 0);
    for (const screenshot of project.screenshots ?? []) {
      const figure = page.locator(`#screenshot-${screenshot.id}`);
      await expect(figure.locator("figcaption")).toHaveText(screenshot.caption);
      const trigger = figure.locator("a");
      await trigger.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          trigger
            .locator("img")
            .evaluate(
              (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
        )
        .toBe(true);
      await trigger.focus();
      await trigger.press("Enter");
      const lightbox = page.locator(".lightbox");
      await expect(lightbox).toBeVisible();
      await expect(lightbox.locator(".lightbox-caption")).toHaveText(screenshot.caption);
      await expect(lightbox.locator("img")).toHaveAttribute("src", screenshot.image);
      await expect
        .poll(() =>
          lightbox
            .locator("img")
            .evaluate(
              (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
        )
        .toBe(true);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.keyboard.press("Escape");
      await expect(lightbox).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
    await page.locator(".detail-header [data-lightbox-image]").click();
    await expect(page.locator(".lightbox")).toBeVisible();
    await page.locator(".lightbox-close").click();
  });
}

test.describe("project screenshots without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  for (const project of screenshotProjects) {
    test(`${project.slug}: captions and full-resolution image links remain available`, async ({ page }) => {
      await page.goto(`/projects/${project.slug}/`);
      const screenshot = project.screenshots?.[0];
      if (!screenshot) throw new Error("Screenshot project requires a screenshot");
      const figure = page.locator(`#screenshot-${screenshot.id}`);
      await expect(figure.locator("figcaption")).toHaveText(screenshot.caption);
      await figure.locator("a").click();
      await expect(page).toHaveURL(new RegExp(`${screenshot.image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    });
  }
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

test("Other page lightbox works for every gallery section", async ({ page }) => {
  await page.goto("/other/");

  const lightbox = page.locator(".lightbox");
  const lightboxImage = lightbox.locator(".lightbox-image");
  const lightboxCaption = lightbox.locator(".lightbox-caption");

  for (const [sectionIndex, section] of otherSections.entries()) {
    const expectedImage = section.images[0];
    if (!expectedImage) throw new Error(`${section.id} must include an image`);

    const trigger = page.locator(".other-section").nth(sectionIndex).locator("[data-lightbox-image]").first();
    const expectedSource = await trigger.getAttribute("data-lightbox-src");
    expect(expectedSource).not.toBeNull();

    await trigger.focus();
    await trigger.click();
    await expect(lightbox).toBeVisible();
    await expect(lightboxImage).toHaveAttribute("src", expectedSource ?? "");
    await expect(lightboxImage).toHaveAttribute("alt", expectedImage.alt);

    if (expectedImage.caption) {
      await expect(lightboxCaption).toBeVisible();
      await expect(lightboxCaption).toHaveText(expectedImage.caption);
    } else {
      await expect(lightboxCaption).toBeHidden();
    }

    await lightbox.locator(".lightbox-close").click();
    await expect(lightbox).not.toBeVisible();
    await expect(lightboxImage).toHaveAttribute("src", "/assets/images/favicon.svg");
    await expect(lightboxImage).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test("rapid lightbox reopening does not let a queued close clear the new image", async ({ page }) => {
  await page.goto("/other/");
  const trigger = page.locator("[data-lightbox-image]").nth(captionedImageIndex);
  await trigger.click();
  await trigger.evaluate((element) => {
    const close = document.querySelector<HTMLButtonElement>(".lightbox-close");
    if (!(element instanceof HTMLAnchorElement) || !close) throw new Error("Missing lightbox controls");
    close.click();
    element.click();
  });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const dialog = page.locator(".lightbox");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".lightbox-image")).toBeVisible();
  await expect(dialog.locator(".lightbox-caption")).toHaveText(captionedImageCaption);
  await dialog.locator(".lightbox-close").click();
  await expect(dialog.locator(".lightbox-image")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Other page gallery images load successfully", async ({ page }) => {
  await page.goto("/other/");

  const images = page.locator(".other-gallery img");
  await expect(images).toHaveCount(otherImages.length);

  for (let index = 0; index < otherImages.length; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (element) =>
            element instanceof HTMLImageElement &&
            element.complete &&
            element.naturalWidth > 0 &&
            element.naturalHeight > 0,
        ),
      )
      .toBe(true);
  }
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
  await page.goto("/other/");
  const trigger = page.locator('[data-lightbox-src*="/snail-by-log-"]');
  const largeImageSource = await trigger.getAttribute("data-lightbox-src");
  expect(largeImageSource).not.toBeNull();

  let releaseImage: (() => void) | undefined;
  let imageRequestIntercepted = false;
  const imageReleased = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route(`**${largeImageSource}`, async (route) => {
    imageRequestIntercepted = true;
    await imageReleased;
    await route.continue();
  });
  await trigger.click();
  await expect.poll(() => imageRequestIntercepted).toBe(true);

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
