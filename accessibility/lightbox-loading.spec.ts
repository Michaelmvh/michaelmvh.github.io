import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

test("lightbox retains the thumbnail and its layout until the larger image is decoded", async ({ page }) => {
  await page.goto("/other/");
  const trigger = page.locator("[data-lightbox-image]").first();
  const thumbnail = trigger.locator("img");
  await thumbnail.scrollIntoViewIfNeeded();
  await expect
    .poll(() => thumbnail.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
    .toBe(true);
  const previewSource = await thumbnail.evaluate((image: HTMLImageElement) => image.currentSrc);
  const source = await trigger.getAttribute("data-lightbox-src");
  if (!source) throw new Error("Missing larger image source");

  // Hold decoding, not just downloading: an undecoded image must never replace the preview.
  await page.evaluate((source) => {
    const decode = HTMLImageElement.prototype.decode;
    const released = new Promise<void>((resolve) => {
      document.addEventListener("release-image-decode", () => resolve(), { once: true });
    });
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (this.getAttribute("src") === source) await released;
    };
  }, source);

  await trigger.click();
  const dialog = page.locator(".lightbox");
  const image = dialog.locator(".lightbox-image");
  await expect(image).toHaveAttribute("src", previewSource);
  await expect(dialog.getByRole("status")).toHaveText("Loading larger image...");
  const before = await image.boundingBox();
  expect(before).not.toBeNull();
  expect(before?.height).toBeGreaterThan(0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.evaluate(() => document.dispatchEvent(new Event("release-image-decode")));
  await expect(image).toHaveAttribute("src", source);
  await expect(dialog.locator(".lightbox-status")).toBeEmpty();
  const after = await image.boundingBox();
  if (!before || !after) throw new Error("Missing preview bounds");
  for (const dimension of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(after[dimension] - before[dimension])).toBeLessThanOrEqual(3);
  }
});

test("failed larger images keep the thumbnail and support a keyboard-accessible retry", async ({ page }) => {
  await page.goto("/other/");
  const trigger = page.locator("[data-lightbox-image]").first();
  await trigger.scrollIntoViewIfNeeded();
  const source = await trigger.getAttribute("data-lightbox-src");
  if (!source) throw new Error("Missing larger image source");
  const previewSource = await trigger.locator("img").evaluate((image: HTMLImageElement) => image.currentSrc);
  let fail = true;
  await page.route(`**${source}`, async (route) => {
    if (fail) await route.abort();
    else await route.continue();
  });
  await trigger.click();
  const dialog = page.locator(".lightbox");
  await expect(dialog.getByRole("status")).toHaveText("The larger image could not load.");
  await expect(dialog.locator(".lightbox-image")).toHaveAttribute("src", previewSource);
  const retry = dialog.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  fail = false;
  await retry.focus();
  await retry.press("Enter");
  await expect(dialog.locator(".lightbox-close")).toBeFocused();
  await expect(dialog.locator(".lightbox-image")).toHaveAttribute("src", source);
  await expect(dialog.locator(".lightbox-status")).toBeEmpty();
  await expect(retry).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

for (const outcome of ["success", "failure"] as const) {
  test(`a late image ${outcome} cannot change a reopened viewer`, async ({ page }) => {
    await page.goto("/other/");
    const triggers = page.locator("[data-lightbox-image]");
    const first = triggers.first();
    const second = triggers.nth(1);
    const source = await first.getAttribute("data-lightbox-src");
    const secondSource = await second.getAttribute("data-lightbox-src");
    if (!source || !secondSource) throw new Error("Missing larger image sources");
    await page.evaluate((source) => {
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () {
        try {
          await decode.call(this);
        } finally {
          if (this.getAttribute("src") === source) document.documentElement.dataset.lateImageSettled = "true";
        }
      };
    }, source);
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let intercepted = false;
    await page.route(`**${source}`, async (route) => {
      intercepted = true;
      await released;
      if (outcome === "failure") await route.abort();
      else await route.continue();
    });
    try {
      await first.click();
      await expect.poll(() => intercepted).toBe(true);
      await page.keyboard.press("Escape");
      await expect(first).toBeFocused();
      await expect(page.locator(".lightbox-image")).toHaveCount(0);
      await second.click();
      const dialog = page.locator(".lightbox");
      await expect(dialog.locator(".lightbox-image")).toHaveAttribute("src", secondSource);
      release();
      await page.unrouteAll({ behavior: "wait" });
      await expect(page.locator("html")).toHaveAttribute("data-late-image-settled", "true");
      await expect(dialog.locator(".lightbox-image")).toHaveAttribute("src", secondSource);
      await expect(dialog.locator(".lightbox-status")).toBeEmpty();
      await expect(dialog.locator(".lightbox-retry")).toBeHidden();
      await dialog.locator(".lightbox-close").click();
      await expect(second).toBeFocused();
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
}
