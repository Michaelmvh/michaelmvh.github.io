import { loadSiteData } from "../scripts/data.ts";
import fs from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { maximumUrlLength } from "../src/client/url-inspector-model.ts";
import { maximumCharacters } from "../src/client/document-limits.ts";

const { pages } = await loadSiteData();
const urlCopy = pages.urlInspector;
const textCopy = pages.textUtilities;

test("URL parameters edit live, preserve duplicates and encoding, and remove only selected trackers", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("http")) requests.push(request.url());
  });
  await page.goto("/tools/url-inspector/");
  const input = page.getByRole("textbox", { name: urlCopy.inputLabel, exact: true });
  const output = page.getByRole("textbox", { name: urlCopy.outputLabel, exact: true });
  await expect(input).toBeEnabled();
  await context.setOffline(true);
  const networkCount = requests.length;
  const original = "https://example.com:8443/path?q=hello+world&q=%2B&utm_source=test&ref=keep#anchor";
  await input.fill(original);
  await expect(output).toHaveValue(original);
  await expect(page.locator("#url-hostname")).toHaveText("example.com");
  await expect(page.locator("#url-port")).toHaveText("8443");
  await expect(page.getByRole("textbox", { name: "Value 1", exact: true })).toHaveValue("hello world");
  await expect(page.getByRole("textbox", { name: "Value 2", exact: true })).toHaveValue("+");
  await page.getByRole("textbox", { name: "Value 1", exact: true }).fill("café & +");
  await expect(output).toHaveValue(
    "https://example.com:8443/path?q=caf%C3%A9%20%26%20%2B&q=%2B&utm_source=test&ref=keep#anchor",
  );
  await expect(input).toHaveValue(original);
  await page.getByRole("button", { name: urlCopy.selectTrackingLabel, exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Select parameter 3 for removal" })).toBeChecked();
  await expect(output).toHaveValue(/utm_source=test/);
  await page.getByRole("button", { name: urlCopy.removeSelectedLabel, exact: true }).click();
  await expect(output).toHaveValue(
    "https://example.com:8443/path?q=caf%C3%A9%20%26%20%2B&q=%2B&ref=keep#anchor",
  );
  await page.getByRole("button", { name: urlCopy.addLabel, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Name 4", exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "Name 4", exact: true }).fill("new key");
  await page.getByRole("textbox", { name: "Value 4", exact: true }).fill("line one\nline two");
  await expect(output).toHaveValue(/&new%20key=line%20one%0Aline%20two#anchor$/);
  for (const checkbox of await page.locator("#url-parameters input[type=checkbox]").all()) {
    await checkbox.check();
  }
  await page.getByRole("button", { name: urlCopy.removeSelectedLabel, exact: true }).click();
  await expect(output).toHaveValue("https://example.com:8443/path#anchor");
  expect(requests).toHaveLength(networkCount);
  expect(requests.every((url) => new URL(url).hostname === "127.0.0.1")).toBe(true);
  await context.setOffline(false);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("URL errors clear stale output and exports, expose encoding problems, and recover", async ({ page }) => {
  await page.goto("/tools/url-inspector/");
  const input = page.getByRole("textbox", { name: urlCopy.inputLabel, exact: true });
  const output = page.getByRole("textbox", { name: urlCopy.outputLabel, exact: true });
  for (const [value, message] of [
    ["javascript:alert(1)", urlCopy.invalidMessage],
    ["https://example.com/?x=%FF", urlCopy.encodingMessage],
    ["https://example.com/?x=" + "x".repeat(maximumUrlLength), urlCopy.limitMessage],
  ]) {
    if (!value || !message) throw new Error("Missing URL error case");
    await input.fill("https://example.com/?q=valid");
    await expect(output).toHaveValue(/q=valid/);
    await input.fill(value);
    await expect(page.locator("#utility-status")).toHaveText(message);
    await expect(output).toHaveValue("");
    await expect(page.getByRole("button", { name: urlCopy.copyLabel })).toBeDisabled();
    await expect(page.locator("#utility-download")).not.toHaveAttribute("href");
  }
  await input.fill("https://user:password@example.com/?x=good");
  await expect(page.getByText(urlCopy.credentialsMessage)).toBeVisible();
  await page.getByRole("textbox", { name: "Value 1", exact: true }).fill("é".repeat(3_000));
  await expect(page.locator("#utility-status")).toHaveText(urlCopy.limitMessage);
  await expect(output).toHaveValue("");
  await page.getByRole("textbox", { name: "Value 1", exact: true }).fill("<img src=x onerror=alert(1)>");
  await expect(output).toHaveValue(/x=%3Cimg/);
  await expect(page.locator(".utility-tool img")).toHaveCount(0);
  await page.getByRole("button", { name: urlCopy.clearLabel, exact: true }).click();
  await expect(input).toBeFocused();
  await expect(page.locator("#url-inspection")).toBeHidden();
});

test("text options compose live with Unicode counts and downloadable empty results", async ({
  page,
  context,
}) => {
  await page.goto("/tools/text-utilities/");
  const input = page.getByRole("textbox", { name: textCopy.inputLabel, exact: true });
  const output = page.getByRole("textbox", { name: textCopy.outputLabel, exact: true });
  await expect(input).toBeEnabled();
  await context.setOffline(true);
  const original = " Zebra \napple\nAPPLE\n   \n Zebra \n";
  await input.fill(original);
  await page.getByLabel(textCopy.caseLabel).selectOption("lower");
  await page.getByLabel(textCopy.trimLabel).check();
  await page.getByLabel(textCopy.removeBlankLabel).check();
  await page.getByLabel(textCopy.deduplicateLabel).check();
  await page.getByLabel(textCopy.sortLabel).selectOption("ascending");
  await expect(output).toHaveValue("apple\nzebra\n");
  await expect(input).toHaveValue(original);
  await expect(page.locator("#text-output-count")).toHaveText("Characters: 12 · Words: 2 · Lines: 2");
  await page.getByLabel(textCopy.sortLabel).selectOption("descending");
  await expect(output).toHaveValue("zebra\napple\n");
  await input.fill("e\u0301 👩‍👩‍👧‍👦\n");
  await expect(page.locator("#text-input-count")).toHaveText("Characters: 4 · Words: 1 · Lines: 1");
  await input.fill(" \n\t\n");
  await expect(output).toHaveValue("");
  await expect(page.getByRole("button", { name: textCopy.copyLabel })).toBeEnabled();
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: textCopy.downloadLabel }).click();
  const downloaded = await downloading;
  const file = await downloaded.path();
  if (!file) throw new Error("Text download did not finish");
  expect(downloaded.suggestedFilename()).toBe("text.txt");
  expect(await fs.readFile(file, "utf8")).toBe("");
  await context.setOffline(false);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Capitalize Each Word updates live without changing original text", async ({ page }) => {
  await page.goto("/tools/text-utilities/");
  const input = page.getByRole("textbox", { name: textCopy.inputLabel, exact: true });
  const output = page.getByRole("textbox", { name: textCopy.outputLabel, exact: true });
  const original = "text WHERE every FIRST letter IS capitalized\nÉCOLE déjà VU";
  await input.fill(original);
  await page.getByLabel(textCopy.caseLabel).selectOption({ label: textCopy.capitalizeLabel });
  await expect(output).toHaveValue("Text Where Every First Letter Is Capitalized\nÉcole Déjà Vu");
  await expect(input).toHaveValue(original);
  await input.fill("another EXAMPLE");
  await expect(output).toHaveValue("Another Example");
});

test("text limits, IME composition, and clearing do not leave stale results", async ({ page }) => {
  await page.goto("/tools/text-utilities/");
  const input = page.getByRole("textbox", { name: textCopy.inputLabel, exact: true });
  const output = page.getByRole("textbox", { name: textCopy.outputLabel, exact: true });
  await input.fill("before");
  await expect(output).toHaveValue("before");
  await input.dispatchEvent("compositionstart");
  await input.fill("after");
  await expect(output).toHaveValue("before");
  await expect(output).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("button", { name: textCopy.copyLabel })).toBeDisabled();
  await input.dispatchEvent("compositionend");
  await expect(output).toHaveValue("after");
  await input.fill("x".repeat(maximumCharacters + 1));
  await expect(page.locator("#utility-status")).toHaveText(textCopy.limitMessage);
  await expect(output).toHaveValue("");
  await expect(page.locator("#utility-download")).not.toHaveAttribute("href");
  await input.fill("pending");
  await page.getByRole("button", { name: textCopy.clearLabel, exact: true }).click();
  await expect(input).toBeFocused();
  await expect(output).toHaveValue("");
  await expect(page.locator("#utility-status")).toHaveText(textCopy.readyMessage);
});

for (const [slug, copy, sample] of [
  ["url-inspector", urlCopy, "https://example.com/?q=caf%C3%A9"],
  ["text-utilities", textCopy, "café\nsecond line"],
] as const) {
  test(`${slug}: exports, clipboard feedback races, and no automatic persistence`, async ({ page }) => {
    await page.goto(`/tools/${slug}/`);
    const input = page.getByRole("textbox", { name: copy.inputLabel, exact: true });
    const output = page.getByRole("textbox", { name: copy.outputLabel, exact: true });
    await input.fill(sample);
    await expect(output).toHaveValue(sample);
    const downloading = page.waitForEvent("download");
    await page.getByRole("link", { name: copy.downloadLabel }).click();
    const file = await (await downloading).path();
    if (!file) throw new Error("Utility download did not finish");
    expect(await fs.readFile(file, "utf8")).toBe(sample);
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text) => {
        document.documentElement.dataset.copiedText = text;
      };
    });
    await page.getByRole("button", { name: copy.copyLabel }).click();
    await expect(page.locator("html")).toHaveAttribute("data-copied-text", sample);
    await expect(page.locator("#utility-feedback")).toHaveText(copy.copiedMessage);
    await page.evaluate(() => {
      navigator.clipboard.writeText = () =>
        new Promise<void>((resolve) => {
          document.addEventListener("release-copy", () => resolve(), { once: true });
        });
    });
    await page.getByRole("button", { name: copy.copyLabel }).click();
    await input.fill(slug === "url-inspector" ? "https://changed.example/" : "changed");
    await page.evaluate(() => document.dispatchEvent(new Event("release-copy")));
    await expect(page.locator("#utility-feedback")).not.toHaveText(copy.copiedMessage);
    await expect(output).toHaveValue(slug === "url-inspector" ? "https://changed.example/" : "changed");
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new Error("Clipboard unavailable");
      };
    });
    await page.getByRole("button", { name: copy.copyLabel }).click();
    await expect(page.locator("#utility-feedback")).toHaveText(copy.copyErrorMessage);
    await page.reload();
    await expect(input).toHaveValue("");
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  });

  test(`${slug}: missing module leaves visible guidance and disabled controls`, async ({ page }) => {
    await page.route("**/utility-common.js", (route) => route.abort());
    await page.goto(`/tools/${slug}/`);
    await expect(page.getByRole("textbox", { name: copy.inputLabel, exact: true })).toBeDisabled();
    await expect(page.locator("#utility-status")).toHaveText(copy.noScriptMessage);
  });

  test.describe(`${slug} without JavaScript`, () => {
    test.use({ javaScriptEnabled: false });
    test("instructions and navigation remain available", async ({ page }) => {
      await page.goto(`/tools/${slug}/`);
      await expect(page.getByRole("heading", { name: copy.heading, exact: true })).toBeVisible();
      await expect(page.getByRole("textbox", { name: copy.inputLabel, exact: true })).toBeDisabled();
      await expect(page.locator("#utility-status")).toHaveText(copy.noScriptMessage);
      await page.getByRole("link", { name: pages.tools.backLabel, exact: true }).click();
      await expect(page).toHaveURL(/\/tools\/$/);
    });
  });
}
