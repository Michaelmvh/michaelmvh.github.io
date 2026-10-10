import { loadSiteData } from "../scripts/data.ts";
import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createLayout } from "../scripts/rendering/layout.ts";
import { createPortfolioRenderer } from "../scripts/rendering/portfolio.ts";
import type { Publication } from "../src/shared/content.ts";

const { site, other: otherSections, projects, news, pages: pageCopy } = await loadSiteData();
const otherImages = otherSections.flatMap((section) => section.images);
const screenshotProjects = projects.filter((project) => project.screenshots?.length);
const fixtureCaption = "A caption used to exercise the image viewer.";
const citationCopy = {
  ...pageCopy.publications,
  copyLabel: "Copy reference",
  copiedMessage: "Reference copied",
  copyErrorMessage: "Reference unavailable",
};

async function openCitationFixture(page: Page): Promise<void> {
  const entries: Publication[] = ["first", "second"].map((id) => ({
    id,
    title: `Example ${id} publication`,
    authors: "Example author",
    venue: "Example journal",
    volume: "1",
    year: 2026,
    doi: `10.1234/${id}`,
    pdf: "/assets/documents/CV.pdf",
    citation: `Citation for ${id}`,
  }));
  const renderer = createPortfolioRenderer({ ...pageCopy, publications: citationCopy }, []);
  const body = createLayout(
    site,
    pageCopy.shared,
  )({
    id: "publications",
    title: citationCopy.title,
    description: citationCopy.description,
    content: renderer.renderPublications(entries),
    analytics: false,
  });
  await page.route("**/publications/", (route) => route.fulfill({ contentType: "text/html", body }));
  await page.goto("/publications/");
  await expect(page.locator(".citation-button")).toHaveCount(entries.length);
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

for (const failure of ["disabled JavaScript", "blocked site script"] as const) {
  test.describe(`navigation with ${failure}`, () => {
    test.use({ javaScriptEnabled: failure !== "disabled JavaScript" });

    test("links remain visible and keyboard-accessible without a working menu button", async ({ page }) => {
      if (failure === "blocked site script") {
        await page.route("**/assets/js/site.js", (route) => route.abort());
      }
      await page.goto("/");
      await expect(page.getByRole("button", { name: pageCopy.shared.menuLabel })).toBeHidden();
      const navigation = page.getByRole("navigation", { name: pageCopy.shared.navigationLabel });
      for (const link of await navigation.getByRole("link").all()) {
        await expect(link).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const link = navigation.locator('a[href^="/"]:not([href="/"])').first();
      const href = await link.getAttribute("href");
      if (!href) throw new Error("Navigation test requires an internal destination");
      await link.focus();
      await expect(link).toBeFocused();
      await link.press("Enter");
      await expect(page).toHaveURL(href);
    });
  });
}

test("mobile navigation collapses only after its delayed script is ready", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseScript!: () => void;
  const scriptReady = new Promise<void>((resolve) => {
    releaseScript = resolve;
  });
  await page.route("**/assets/js/site.js", async (route) => {
    await scriptReady;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    const navigation = page.getByRole("navigation", { name: pageCopy.shared.navigationLabel });
    const menu = page.getByRole("button", { name: pageCopy.shared.menuLabel });
    await expect(navigation).toBeVisible();
    await expect(menu).toBeHidden();
    releaseScript();
    await expect(menu).toBeVisible();
    await expect(navigation).toBeHidden();
    await menu.focus();
    await menu.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(navigation).toBeVisible();
    await menu.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(navigation).toBeHidden();
  } finally {
    releaseScript();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("the skip link stays clipped while scrolling and remains keyboard-accessible in dark device mode", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/tools/");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toHaveCSS("clip-path", "inset(50%)");
  await expect(skip).toHaveCSS("transform", "none");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect(skip).toHaveCSS("clip-path", "inset(50%)");
  await skip.focus();
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS("clip-path", "none");
  await skip.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await page.getByRole("heading", { level: 1 }).click();
  await expect(skip).toHaveCSS("clip-path", "inset(50%)");
});

test("bookmark icon declarations resolve to PNGs for both the site and tools", async ({ page, request }) => {
  for (const [route, expected] of [
    ["/", "/apple-touch-icon.png"],
    ["/tools/", "/tools/apple-touch-icon.png"],
    ["/tools/mermaid/", "/tools/apple-touch-icon.png"],
  ]) {
    if (!route || !expected) throw new Error("Missing bookmark icon test case");
    await page.goto(route);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", expected);
    const response = await request.get(expected);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
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
  await openCitationFixture(page);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => undefined;
  });

  const button = page.locator(".citation-button").first();
  await button.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("Citation control is not an HTML element");
    element.click();
    element.click();
  });

  await expect(button).toHaveText(citationCopy.copiedMessage);
  await expect(page.locator(".citation-button").nth(1)).toHaveText(citationCopy.copyLabel);
  await expect(button).toHaveText(citationCopy.copyLabel, { timeout: 2_500 });
});

test("theme selection persists across pages and reloads and can be reset", async ({ page }) => {
  await page.goto("/");
  await page.locator('.theme-trigger[data-site-theme="scifi"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-site-theme", "scifi");
  await expect(page.locator("[data-theme-reset]")).toHaveAccessibleName(
    pageCopy.shared.returnToDefaultTheme.replaceAll("{theme}", "scifi"),
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-site-theme", "scifi");
  await page.goto("/publications/");
  await expect(page.locator("html")).toHaveAttribute("data-site-theme", "scifi");
  await page.locator("[data-theme-reset]").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-site-theme");
  expect(await page.evaluate(() => localStorage.getItem("site-theme"))).toBeNull();
  await page.reload();
  await expect(page.locator("[data-theme-reset]")).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-site-theme");
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
  await openCitationFixture(page);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => Promise.reject(new Error("Clipboard unavailable"));
  });

  const button = page.locator(".citation-button").first();
  await button.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("Citation control is not an HTML element");
    element.click();
  });

  await expect(button).toHaveText(citationCopy.copyErrorMessage);
  await expect(button).toHaveText(citationCopy.copyLabel, { timeout: 2_500 });
  expect(pageErrors).toEqual([]);
});

test("Other page lightbox opens, clears captions, closes, and restores focus", async ({ page }) => {
  await page.goto("/other/");

  const captionedTrigger = page.locator("[data-lightbox-image]").first();
  await captionedTrigger.evaluate((element, caption) => {
    element.setAttribute("data-lightbox-caption", caption);
  }, fixtureCaption);
  const expectedAlt = await captionedTrigger.getAttribute("data-lightbox-alt");
  if (expectedAlt === null) throw new Error("Lightbox trigger is missing alt text");
  await captionedTrigger.focus();
  await captionedTrigger.press("Enter");

  const lightbox = page.locator(".lightbox");
  await expect(lightbox).toBeVisible();
  await expect(lightbox.locator(".lightbox-image")).toHaveAttribute("alt", expectedAlt);
  await expect(lightbox.locator(".lightbox-caption")).toHaveText(fixtureCaption);

  await page.keyboard.press("Escape");
  await expect(lightbox).not.toBeVisible();
  await expect(captionedTrigger).toBeFocused();

  const uncaptionedTrigger = captionedTrigger;
  await uncaptionedTrigger.evaluate((element) => element.removeAttribute("data-lightbox-caption"));
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
    await expect(lightboxImage).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test("rapid lightbox reopening does not let a queued close clear the new image", async ({ page }) => {
  await page.goto("/other/");
  const trigger = page.locator("[data-lightbox-image]").first();
  await trigger.evaluate((element, caption) => {
    element.setAttribute("data-lightbox-caption", caption);
  }, fixtureCaption);
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
  await expect(dialog.locator(".lightbox-caption")).toHaveText(fixtureCaption);
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
