import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import type { Bake, Project } from "../scripts/types.ts";

const projects = JSON.parse(await fs.readFile("src/data/projects.json", "utf8")) as Project[];
const baking = JSON.parse(await fs.readFile("src/data/baking.json", "utf8")) as Bake[];
const portraitProject = projects.find((project) =>
  project.screenshots?.some((image) => image.height > image.width),
);
const portrait = portraitProject?.screenshots?.find((image) => image.height > image.width);
if (!portraitProject || !portrait) throw new Error("Lightbox layout coverage requires a portrait screenshot");
const portraitRoute = `/projects/${portraitProject.slug}/`;
const portraitSelector = `#screenshot-${portrait.id} a`;
const portraitCaption = portrait.caption;

const viewports = [
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 560, height: 800 },
  { width: 561, height: 800 },
  { width: 800, height: 1024 },
  { width: 801, height: 1024 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
];

const imagePages = [
  { route: "/baking/", selector: ".bake-card img" },
  { route: "/projects/", selector: ".project-card img" },
  ...baking.map((bake) => ({ route: `/bakes/${bake.slug}/`, selector: ".detail-header img" })),
  ...projects.map((project) => ({
    route: `/projects/${project.slug}/`,
    selector: ".detail-header img",
  })),
];

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height} image layout`, () => {
    test.use({ viewport });
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("cards and detail images reserve their space before download", async ({ page }) => {
      test.setTimeout(90_000);
      for (const { route, selector } of imagePages) {
        let releaseImages!: () => void;
        const imagesReleased = new Promise<void>((resolve) => {
          releaseImages = resolve;
        });
        await page.route("**/assets/images/**", async (request) => {
          await imagesReleased;
          await request.continue();
        });
        try {
          await page.goto(route, { waitUntil: "domcontentloaded" });
          await page.evaluate(() => document.fonts.ready);
          const images = page.locator(selector);
          expect(await images.count()).toBeGreaterThan(0);
          await images.evaluateAll((elements) => {
            for (const image of elements) {
              if (!(image instanceof HTMLImageElement)) throw new Error("Expected an image");
              image.loading = "eager";
            }
          });
          const before = await images.evaluateAll((elements) =>
            elements.map((image) => {
              if (!(image instanceof HTMLImageElement)) throw new Error("Expected an image");
              const { x, y, width, height } = image.getBoundingClientRect();
              return { x, y, width, height, naturalWidth: image.naturalWidth };
            }),
          );
          for (const bounds of before) {
            expect(bounds.naturalWidth, `${route}: images must still be waiting for download`).toBe(0);
            expect(bounds.height, `${route}: reserve image height before download`).toBeGreaterThan(0);
          }
          releaseImages();
          await expect
            .poll(() =>
              images.evaluateAll((elements) =>
                elements.every(
                  (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
                ),
              ),
            )
            .toBe(true);
          const after = await images.evaluateAll((elements) =>
            elements.map((image) => {
              const { x, y, width, height } = image.getBoundingClientRect();
              return { x, y, width, height };
            }),
          );
          for (const [index, bounds] of after.entries()) {
            const previous = before[index];
            if (!previous) throw new Error("Image disappeared while loading");
            for (const dimension of ["x", "y", "width", "height"] as const) {
              expect(
                Math.abs(bounds[dimension] - previous[dimension]),
                `${route}: image ${index} ${dimension} changed after loading`,
              ).toBeLessThanOrEqual(3);
            }
          }
          await expectNoHorizontalOverflow(page);
        } finally {
          releaseImages();
          await page.unrouteAll({ behavior: "wait" });
        }
      }
    });

    test("lightbox captions remain reachable and dismissal preserves focus and page position", async ({
      page,
    }) => {
      await page.goto(portraitRoute);
      const trigger = page.locator(portraitSelector);
      await trigger.focus();
      const backgroundY = await page.evaluate(() => scrollY);
      await trigger.press("Enter");
      const dialog = page.locator(".lightbox");
      const close = dialog.locator(".lightbox-close");
      const caption = dialog.locator(".lightbox-caption");
      await expect(dialog).toBeVisible();
      await expect(close).toBeFocused();
      await expect(caption).toHaveText(portraitCaption);
      await expect
        .poll(() =>
          dialog
            .locator("img")
            .evaluate(
              (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
        )
        .toBe(true);
      await expectWithinViewport(dialog, viewport);
      await expectWithinViewport(close, viewport);

      // An intentionally long caption covers future content, not just today's short captions.
      await caption.evaluate((element, text) => {
        element.textContent = `${text} `.repeat(30);
      }, portraitCaption);
      await page.keyboard.press("Shift+Tab");
      await expect(dialog.locator(".lightbox-panel")).toBeFocused();
      await page.keyboard.press("End");
      await expect.poll(() => captionEndIsReachable(caption, dialog)).toBe(true);
      await expect(dialog.locator(".lightbox-panel")).toBeFocused();
      await expectWithinViewport(close, viewport);
      await expectNoHorizontalOverflow(page);
      expect(await page.evaluate(() => scrollY)).toBeCloseTo(backgroundY, 0);
      const closeBefore = await close.boundingBox();

      await page.keyboard.press("Home");
      await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBe(0);
      await caption.click();
      await expect(dialog).toBeVisible();
      const bounds = await dialog.boundingBox();
      if (!bounds) throw new Error("Missing dialog bounds");
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.wheel(0, 10_000);
      await expect.poll(() => captionEndIsReachable(caption, dialog)).toBe(true);
      await page.mouse.wheel(0, 10_000);
      expect(await page.evaluate(() => scrollY)).toBeCloseTo(backgroundY, 0);
      expect(await close.boundingBox()).toEqual(closeBefore);
      await close.click();
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();

      await trigger.press("Enter");
      await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBe(0);
      await expect(caption).toHaveText(portraitCaption);
      for (let tab = 0; tab < 4; tab += 1) {
        await page.keyboard.press("Tab");
        expect(
          await dialog.evaluate(
            (element) => document.activeElement === document.body || element.contains(document.activeElement),
          ),
        ).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();

      await trigger.click();
      await page.mouse.click(1, 1);
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => scrollY)).toBeCloseTo(backgroundY, 0);
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, -10_000);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    });
  });
}

test("touch scrolling reaches overflowing lightbox captions without moving the page", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Touch gesture coverage uses the mobile browser project");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(portraitRoute);
  const trigger = page.locator(portraitSelector);
  await trigger.tap();
  const dialog = page.locator(".lightbox");
  const caption = dialog.locator(".lightbox-caption");
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  const backgroundY = await page.evaluate(() => scrollY);
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 160, y: 440 }],
    });
    for (const y of [380, 320, 260, 200, 140]) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 160, y }] });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => captionEndIsReachable(caption, dialog)).toBe(true);
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(backgroundY, 0);
    await dialog.locator(".lightbox-close").tap();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  } finally {
    await session.detach();
  }
});

async function captionEndIsReachable(caption: Locator, dialog: Locator): Promise<boolean> {
  const captionBounds = await caption.boundingBox();
  const dialogBounds = await dialog.boundingBox();
  if (!captionBounds || !dialogBounds) return false;
  const bottom = captionBounds.y + captionBounds.height;
  return bottom <= dialogBounds.y + dialogBounds.height + 2 && bottom > dialogBounds.y;
}

async function expectWithinViewport(
  locator: Locator,
  viewport: { width: number; height: number },
): Promise<void> {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error("Expected visible element");
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.y).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const dialog = page.locator(".lightbox:visible");
  if (await dialog.count()) {
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
}
