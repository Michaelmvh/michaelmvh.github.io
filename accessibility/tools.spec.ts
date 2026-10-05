import { loadSiteData } from "../scripts/data.ts";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import sharp from "sharp";

const {
  pages: { qrCode: copy, tools: directoryCopy },
  tools,
} = await loadSiteData();
const jsQR: typeof import("jsqr").default = createRequire(import.meta.url)("jsqr");

async function decodeDownload(page: Page, format: "PNG" | "SVG"): Promise<string | undefined> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: format === "PNG" ? copy.pngLabel : copy.svgLabel }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`qr-code.${format.toLowerCase()}`);
  const file = await download.path();
  if (!file) throw new Error("QR download did not complete");
  const bytes = await fs.readFile(file);
  const source = sharp(bytes, { density: format === "SVG" ? 576 : 72 });
  const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(info.width).toBe(info.height);
  expect([...data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data;
}

test("QR previews and both downloads preserve URLs, Unicode, and whitespace offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const network: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().startsWith("http")) network.push(request.url());
  });
  await page.goto("/tools/qr-code/");
  const input = page.getByRole("textbox", { name: copy.inputLabel });
  await expect(input).toBeEnabled();
  await expect(page.getByRole("status")).toHaveText(copy.emptyMessage);
  await expect(page.getByRole("link", { name: copy.pngLabel })).toBeHidden();
  await context.setOffline(true);
  const requestCount = network.length;
  for (const text of [
    "https://example.com/path?one=1&two=hello#section",
    "  caf\u00e9 \u6771\u4eac \ud83d\ude80\n<hello> & goodbye  ",
  ]) {
    await input.fill(text);
    await expect(page.getByRole("img", { name: copy.previewLabel })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(copy.readyMessage);
    expect(await decodeDownload(page, "PNG")).toBe(text);
    expect(await decodeDownload(page, "SVG")).toBe(text);
  }
  expect(network).toHaveLength(requestCount);
  expect(network.every((url) => new URL(url).hostname === "127.0.0.1")).toBe(true);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.setOffline(false);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("byte limits, clearing, and edits never leave stale downloads", async ({ page }) => {
  await page.goto("/tools/qr-code/");
  const input = page.getByRole("textbox", { name: copy.inputLabel });
  await expect(input).toBeEnabled();
  for (const text of ["a".repeat(2_000), "\u00e9".repeat(1_000)]) {
    await input.fill(text);
    await expect(page.getByRole("status")).toHaveText(copy.readyMessage);
    expect(await decodeDownload(page, "PNG")).toBe(text);
    await input.fill(`${text}a`);
    await expect(page.getByRole("status")).toHaveText(copy.tooLongMessage);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("img", { name: copy.previewLabel })).toBeHidden();
    await expect(page.getByRole("link", { name: copy.pngLabel })).toBeHidden();
    await expect(page.locator("#qr-png")).not.toHaveAttribute("href");
    await expect(page.locator("#qr-svg")).not.toHaveAttribute("href");
  }
  await input.fill("Revised");
  await expect(input).not.toHaveAttribute("aria-invalid");
  expect(await decodeDownload(page, "PNG")).toBe("Revised");
  const clear = page.getByRole("button", { name: copy.clearLabel, exact: true });
  await clear.focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("status")).toHaveText(copy.emptyMessage);
  await expect(page.getByRole("link", { name: copy.svgLabel })).toBeHidden();
  await input.fill("Temporary input");
  await page.reload();
  await expect(input).toHaveValue("");
});

test("module failures have visible feedback and disabled controls", async ({ page }) => {
  await page.route("**/vendor/qrcode.mjs", (route) => route.abort());
  await page.goto("/tools/qr-code/");
  await expect(page.getByRole("status")).toHaveText(copy.loadErrorMessage);
  await expect(page.getByRole("textbox", { name: copy.inputLabel })).toBeDisabled();
  await expect(page.getByRole("link", { name: copy.pngLabel })).toBeHidden();
});

test("rendering failures remove previous downloads and explain the error", async ({ page }) => {
  await page.goto("/tools/qr-code/");
  const input = page.getByRole("textbox", { name: copy.inputLabel });
  await expect(input).toBeEnabled();
  await input.fill("First QR");
  await expect(page.getByRole("status")).toHaveText(copy.readyMessage);
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toDataURL = () => {
      throw new Error("Simulated canvas failure");
    };
  });
  await input.fill("Second QR");
  await expect(page.getByRole("status")).toHaveText(copy.errorMessage);
  await expect(page.getByRole("img", { name: copy.previewLabel })).toBeHidden();
  await expect(page.getByRole("link", { name: copy.pngLabel })).toBeHidden();
});

test("QR previews are fully drawn synchronously without image-loading text", async ({ page }) => {
  await page.goto("/tools/qr-code/");
  const input = page.getByRole("textbox", { name: copy.inputLabel });
  await expect(input).toBeEnabled();
  const results = await input.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error("Missing QR input");
    return ["h", "https://", "https://example.com"].map((text) => {
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      const preview = document.querySelector(".qr-preview");
      const canvas = preview?.querySelector("canvas");
      const context = canvas?.getContext("2d");
      if (!canvas || !context) throw new Error("Preview was not painted before input completed");
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      return {
        hasDarkModules: pixels.some((value, index) => index % 4 === 0 && value === 0),
        hasLoadingImage: Boolean(preview?.querySelector("img")),
      };
    });
  });
  for (const result of results) {
    expect(result).toEqual({ hasDarkModules: true, hasLoadingImage: false });
  }
  await expect(page.getByRole("img", { name: copy.previewLabel })).toBeVisible();
});

for (const javaScriptEnabled of [true, false]) {
  test.describe(`tool directory with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, () => {
    test.use({ javaScriptEnabled });
    test("registry cards open individual tools and link back without loading QR code on the index", async ({
      page,
    }) => {
      const scriptRequests: string[] = [];
      page.on("request", (request) => {
        if (request.resourceType() === "script") scriptRequests.push(request.url());
      });
      await page.goto("/tools/");
      await expect(page.getByRole("heading", { name: directoryCopy.heading, exact: true })).toBeVisible();
      await expect(page.getByRole("textbox")).toHaveCount(0);
      expect(scriptRequests.some((url) => /qr-code|qrcode|tools\.js/.test(url))).toBe(false);
      for (const tool of tools) {
        const card = page.getByRole("link", { name: tool.name, exact: true });
        await expect(card).toHaveAttribute("href", `/tools/${tool.slug}/`);
        await card.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(new RegExp(`/tools/${tool.slug}/$`));
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.getByRole("link", { name: directoryCopy.backLabel, exact: true }).click();
        await expect(page).toHaveURL(/\/tools\/$/);
      }
    });
  });
}

test.describe("tools without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("instructions remain visible and controls are disabled", async ({ page }) => {
    await page.goto("/tools/qr-code/");
    await expect(page.getByRole("heading", { name: copy.heading })).toBeVisible();
    await expect(page.getByText(copy.noScriptMessage)).toBeVisible();
    await expect(page.getByRole("textbox", { name: copy.inputLabel })).toBeDisabled();
    await expect(page.getByRole("link", { name: copy.pngLabel })).toBeHidden();
  });
});
