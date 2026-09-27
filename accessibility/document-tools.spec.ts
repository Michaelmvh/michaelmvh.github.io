import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Pages } from "../scripts/types.ts";

const pages = JSON.parse(await fs.readFile("src/data/pages.json", "utf8")) as Pages;
const copy = pages.tools.documentEditor;
const modes = [
  { route: "/tools/json/", pageCopy: pages.jsonFormatter },
  { route: "/tools/text-diff/", pageCopy: pages.textDiff },
];

async function openJson(page: Page): Promise<void> {
  await page.goto("/tools/json/");
  await expect(page.getByRole("textbox", { name: pages.jsonFormatter.originalLabel })).toBeEnabled();
}

test("JSON formats, sorts, minifies, copies, and downloads without changing the original", async ({
  page,
}) => {
  await openJson(page);
  const original = page.getByRole("textbox", { name: pages.jsonFormatter.originalLabel });
  const source = '{"z":90071992547409931234567890,"a":{"z":1,"a":2},"__proto__":false}';
  await original.fill(source);
  await page.getByRole("button", { name: copy.formatLabel, exact: true }).click();
  const output = page.getByRole("textbox", { name: copy.formattedHeading });
  await expect(output).toHaveValue(
    '{\n  "z": 90071992547409931234567890,\n  "a": {\n    "z": 1,\n    "a": 2\n  },\n  "__proto__": false\n}',
  );
  await expect(original).toHaveValue(source);
  await page.getByRole("checkbox", { name: pages.jsonFormatter.optionLabel }).check();
  await expect(output).toBeHidden();
  await page.getByRole("button", { name: copy.minifyLabel, exact: true }).click();
  const expected = '{"__proto__":false,"a":{"a":2,"z":1},"z":90071992547409931234567890}';
  await expect(output).toHaveValue(expected);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: copy.downloadLabel }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("formatted.json");
  const file = await download.path();
  if (!file) throw new Error("JSON download did not finish");
  expect(await fs.readFile(file, "utf8")).toBe(expected);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.documentElement.dataset.copied = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: copy.copyLabel }).click();
  await expect(page.locator("#document-output-status")).toHaveText(copy.copiedMessage);
  expect(await page.locator("html").getAttribute("data-copied")).toBe(expected);
  await original.fill("{");
  await expect(output).toBeHidden();
  await expect(page.locator("#document-download")).not.toHaveAttribute("href");
  await page.getByRole("button", { name: copy.formatLabel, exact: true }).click();
  await expect(original).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#document-status")).toContainText("line 1");
  await expect(page.locator("#document-status")).toContainText(pages.jsonFormatter.originalLabel);
});

test("JSON comparisons ignore formatting, optionally sort keys, and identify invalid revised JSON", async ({
  page,
}) => {
  await openJson(page);
  const original = page.getByRole("textbox", { name: pages.jsonFormatter.originalLabel });
  const revised = page.getByRole("textbox", { name: pages.jsonFormatter.revisedLabel });
  await original.fill('{"b":2,"a":1}');
  await revised.fill('{\n "a": 1, "b": 2\n}');
  await expect(page.locator(".diff-added")).not.toHaveCount(0);
  await page.getByRole("checkbox", { name: pages.jsonFormatter.optionLabel }).check();
  await expect(page.locator("#document-status")).toHaveText(copy.identicalMessage);
  await revised.fill('{"a":1,"a":2}');
  await expect(revised).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#document-status")).toContainText(pages.jsonFormatter.revisedLabel);
  await expect(page.locator("#document-status")).toContainText("duplicate");
  await revised.fill("null");
  await expect(revised).not.toHaveAttribute("aria-invalid");
});

test("JSON clipboard failures are explicit and pending copies cannot overwrite later feedback", async ({
  page,
}) => {
  await openJson(page);
  const original = page.getByRole("textbox", { name: pages.jsonFormatter.originalLabel });
  await original.fill("null");
  await page.getByRole("button", { name: copy.formatLabel, exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    });
  });
  await page.getByRole("button", { name: copy.copyLabel }).click();
  await expect(page.locator("#document-output-status")).toHaveText(copy.copyErrorMessage);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          new Promise<void>((resolve) => {
            document.addEventListener("complete-test-copy", () => resolve(), { once: true });
          }),
      },
    });
  });
  await page.getByRole("button", { name: copy.copyLabel }).click();
  await original.fill("true");
  await page.evaluate(() => document.dispatchEvent(new Event("complete-test-copy")));
  await expect(page.locator("#document-status")).toHaveText(copy.waitingMessage);
  await expect(page.locator("#document-output-status")).toHaveText("");
});

test("JSON formatting remains available while live comparisons update independently", async ({ page }) => {
  await openJson(page);
  const original = page.getByRole("textbox", { name: pages.jsonFormatter.originalLabel });
  const revised = page.getByRole("textbox", { name: pages.jsonFormatter.revisedLabel });
  await original.fill('{"value":1}');
  await expect(page.locator("#document-status")).toHaveText(copy.waitingMessage);
  await page.getByRole("button", { name: copy.formatLabel, exact: true }).click();
  const output = page.getByRole("textbox", { name: copy.formattedHeading });
  await expect(output).toHaveValue('{\n  "value": 1\n}');
  await revised.fill('{"value":2}');
  await expect(page.locator(".diff-added code")).toContainText('"value": 2');
  await expect(output).toBeVisible();
  await expect(output).toHaveValue('{\n  "value": 1\n}');
  await expect(page.locator("#document-output-status")).toHaveText(copy.formattedMessage);
  await revised.fill("{");
  await expect(page.locator("#document-status")).toContainText("invalid JSON");
  await expect(page.locator("#document-diff")).toBeHidden();
  await expect(output).toBeVisible();
  await revised.fill('{"value":1}');
  await expect(page.locator("#document-status")).toHaveText(copy.identicalMessage);
  await original.fill('{"value":3}');
  await expect(output).toBeHidden();
  await expect(page.locator(".diff-removed code")).toContainText('"value": 3');
});

test("text comparisons show additions, deletions, final newline changes, and whitespace options", async ({
  page,
}) => {
  await page.goto("/tools/text-diff/");
  const original = page.getByRole("textbox", { name: pages.textDiff.originalLabel });
  const revised = page.getByRole("textbox", { name: pages.textDiff.revisedLabel });
  await expect(original).toBeEnabled();
  await original.fill("keep\nold\n");
  await revised.fill("keep\nnew\n");
  await expect(page.locator(".diff-added code")).toHaveText("new");
  await expect(page.locator(".diff-removed code")).toHaveText("old");
  await expect(page.locator("#document-status")).toHaveText("1 lines added; 1 lines removed.");
  await original.fill("  same \n");
  await revised.fill("same");
  await expect(page.locator(".diff-eof")).toHaveText(copy.noNewlineLabel);
  await page.getByRole("checkbox", { name: pages.textDiff.optionLabel }).check();
  await expect(page.locator("#document-status")).toHaveText(copy.identicalMessage);
  await page.getByRole("button", { name: copy.clearLabel, exact: true }).click();
  await expect(original).toBeFocused();
  await expect(original).toHaveValue("");
  await expect(revised).toHaveValue("");
  await expect(page.locator("#document-status")).toHaveText(copy.readyMessage);
  await expect(page.locator("#document-diff")).toBeHidden();
  await revised.fill("one addition");
  await expect(page.locator(".diff-added code")).toHaveText("one addition");
});

for (const { route, pageCopy } of modes) {
  test(`${route}: changed characters are highlighted precisely and remain accessible in each theme`, async ({
    page,
  }) => {
    await page.goto(route);
    const original = page.getByRole("textbox", { name: pageCopy.originalLabel });
    const revised = page.getByRole("textbox", { name: pageCopy.revisedLabel });
    await expect(original).toBeEnabled();
    const isJson = route.includes("/json/");
    await original.fill(isJson ? '{"value":100,"same":"unchanged"}' : "prefix 100 suffix\n");
    await revised.fill(isJson ? '{"value":101,"same":"unchanged"}' : "prefix 101 suffix\n");
    await expect(page.locator(".diff-removed del")).toHaveText("0");
    await expect(page.locator(".diff-added ins")).toHaveText("1");
    await expect(page.locator(".diff-unchanged .diff-highlight")).toHaveCount(0);
    await expect(page.locator(".diff-added code")).toContainText(
      isJson ? '"value": 101' : "prefix 101 suffix",
    );
    await revised.fill(isJson ? '{"value":102,"same":"unchanged"}' : "prefix 102 suffix\n");
    await expect(page.locator(".diff-added ins")).toHaveText("2");
    for (const theme of ["museum", "blueprint", "scifi"]) {
      await page.evaluate((value) => {
        if (value === "museum") delete document.documentElement.dataset.siteTheme;
        else document.documentElement.dataset.siteTheme = value;
      }, theme);
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation instanceof CSSTransition)
            .map((animation) => animation.finished),
        );
      });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });

  test(`${route}: live changes are debounced, preserve the previous diff, and cancel on Clear`, async ({
    page,
  }) => {
    await page.goto(route);
    const original = page.getByRole("textbox", { name: pageCopy.originalLabel });
    const revised = page.getByRole("textbox", { name: pageCopy.revisedLabel });
    await expect(original).toBeEnabled();
    await original.fill("1");
    await revised.fill("2");
    await expect(page.locator(".diff-added code")).toHaveText("2");
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await revised.fill("3");
    await expect(page.locator("#document-diff")).toBeVisible();
    await expect(page.locator("#document-diff")).toHaveAttribute("aria-busy", "true");
    await page.clock.runFor(150);
    await revised.fill("4");
    await page.clock.runFor(199);
    await expect(page.locator(".diff-added code")).toHaveText("2");
    await page.clock.runFor(1);
    await expect(page.locator(".diff-added code")).toHaveText("4");
    await expect(page.locator("#document-diff")).not.toHaveAttribute("aria-busy");
    await expect(revised).toBeFocused();
    await revised.fill("5");
    await page
      .getByRole("button", { name: copy.clearLabel, exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
    await page.clock.runFor(500);
    await expect(page.locator("#document-diff")).toBeHidden();
    await expect(page.locator("#document-status")).toHaveText(copy.readyMessage);
    await expect(original).toBeFocused();
  });

  test(`${route}: live comparison waits until IME composition finishes`, async ({ page }) => {
    await page.goto(route);
    const original = page.getByRole("textbox", { name: pageCopy.originalLabel });
    const revised = page.getByRole("textbox", { name: pageCopy.revisedLabel });
    await expect(original).toBeEnabled();
    await original.fill("1");
    await revised.fill("2");
    await expect(page.locator(".diff-added code")).toHaveText("2");
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await revised.dispatchEvent("compositionstart");
    await revised.fill("3");
    await page.clock.runFor(1_000);
    await expect(page.locator(".diff-added code")).toHaveText("2");
    await revised.dispatchEvent("compositionend");
    await page.clock.runFor(200);
    await expect(page.locator(".diff-added code")).toHaveText("3");
  });

  test(`${route}: works offline, renders pasted markup literally, and remains accessible`, async ({
    page,
    context,
  }) => {
    const requests: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith("http")) requests.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(route);
    const original = page.getByRole("textbox", { name: pageCopy.originalLabel });
    const revised = page.getByRole("textbox", { name: pageCopy.revisedLabel });
    await expect(original).toBeEnabled();
    await context.setOffline(true);
    const requestCount = requests.length;
    const markup = '<img src="https://example.invalid/leak" onerror="alert(1)"> \u6771\u4eac';
    await original.fill(route.includes("/json/") ? JSON.stringify({ value: "old" }) : "old");
    await revised.fill(route.includes("/json/") ? JSON.stringify({ value: markup }) : markup);
    await expect(page.locator(".diff-added code")).toContainText(
      route.includes("/json/") ? "example.invalid" : markup,
    );
    await expect(page.locator("#document-diff img")).toHaveCount(0);
    expect(requests).toHaveLength(requestCount);
    expect(requests.every((url) => new URL(url).hostname === "127.0.0.1")).toBe(true);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (route.includes("text-diff")) {
      expect(requests.some((url) => url.includes("json-format"))).toBe(false);
    }
    await context.setOffline(false);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.reload();
    await expect(original).toHaveValue("");
    await expect(revised).toHaveValue("");
  });

  test(`${route}: limits clear stale output and report a useful error`, async ({ page }) => {
    await page.goto(route);
    const original = page.getByRole("textbox", { name: pageCopy.originalLabel });
    const revised = page.getByRole("textbox", { name: pageCopy.revisedLabel });
    await expect(original).toBeEnabled();
    await original.fill("1");
    await revised.fill("2");
    await expect(page.getByRole("region", { name: copy.diffHeading, exact: true })).toBeVisible();
    await original.fill("a".repeat(100_001));
    await expect(page.locator("#document-status")).toHaveText(copy.limitMessage);
    await expect(page.getByRole("region", { name: copy.diffHeading, exact: true })).toBeHidden();
  });

  test(`${route}: dependency load failures keep controls disabled with feedback`, async ({ page }) => {
    await page.route("**/chunks/document-diff-*.js", (request) => request.abort());
    await page.goto(route);
    await expect(page.locator("#document-status")).toHaveText(copy.loadErrorMessage);
    await expect(page.getByRole("textbox", { name: pageCopy.originalLabel })).toBeDisabled();
  });

  test.describe(`${route} without JavaScript`, () => {
    test.use({ javaScriptEnabled: false });
    test("explains the requirement and retains directory navigation", async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: pageCopy.heading, exact: true })).toBeVisible();
      await expect(page.locator("#document-status")).toHaveText(copy.noScriptMessage);
      await expect(page.getByRole("textbox", { name: pageCopy.originalLabel })).toBeDisabled();
      await page.getByRole("link", { name: pages.tools.backLabel, exact: true }).click();
      await expect(page).toHaveURL(/\/tools\/$/);
    });
  });
}
