import { loadSiteData } from "../scripts/data.ts";
import fs from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { FrameLocator, Page } from "@playwright/test";
import { recoveryKey, recoveryLimit } from "../src/client/mermaid-recovery.ts";

const { mermaid: copy } = (await loadSiteData()).pages;

async function openEditor(page: Page): Promise<FrameLocator> {
  await page.goto("/tools/mermaid/");
  await expect(page.locator("#mermaid-status")).toHaveText(copy.readyMessage);
  const editor = page.frameLocator("#mermaid-editor");
  await expect(editor.locator(".react-flow__node").first()).toBeVisible();
  return editor;
}

async function showCode(editor: FrameLocator): Promise<void> {
  const toggle = editor.getByRole("button", { name: "Code", exact: true });
  if ((await toggle.isVisible()) && (await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await editor.getByRole("tab", { name: "Mermaid", exact: true }).click();
}

async function showCanvas(editor: FrameLocator): Promise<void> {
  const codeToggle = editor.getByRole("button", { name: "Code", exact: true });
  if ((await codeToggle.isVisible()) && (await codeToggle.getAttribute("aria-expanded")) === "true") {
    await codeToggle.click();
  }
}

async function setSource(page: Page, editor: FrameLocator, source: string): Promise<void> {
  await showCode(editor);
  const code = editor.getByRole("textbox", { name: "Mermaid source", exact: true });
  // CodeMirror's Android input handling needs an actual select-all edit, not DOM replacement.
  await code.click();
  await code.press("ControlOrMeta+A");
  await page.keyboard.insertText(source);
}

async function action(editor: FrameLocator, name: string): Promise<void> {
  const button = editor.getByRole("button", { name, exact: true });
  if (await button.isVisible()) await button.click();
  else {
    await editor.getByRole("button", { name: "More", exact: true }).click();
    await editor.getByRole("button", { name, exact: true }).click();
  }
}

test("visual creation and source editing update each other with undo and redo", async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("http") && new URL(url).hostname !== "127.0.0.1") external.push(url);
  });
  const editor = await openEditor(page);
  await showCode(editor);
  await setSource(page, editor, 'flowchart LR\n A["First café 🚀"]\n B{"Ready?"}');
  await expect(editor.locator(".react-flow__node")).toHaveCount(2);
  await showCanvas(editor);
  const first = editor.locator('.react-flow__node[data-id="A"]');
  const second = editor.locator('.react-flow__node[data-id="B"]');
  await first.focus();
  await page.keyboard.press("c");
  await second.focus();
  await page.keyboard.press("Enter");
  await expect(editor.locator(".cm-content")).toContainText("A --> B");
  await editor.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.locator(".cm-content")).not.toContainText("A --> B");
  await editor.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor.locator(".cm-content")).toContainText("A --> B");
  await first.click();
  await showCode(editor);
  await editor.getByRole("textbox", { name: "Label", exact: true }).fill('Changed <label> & "text"');
  await expect(editor.locator(".cm-content")).toContainText("Changed");
  await expect(first).toContainText('Changed <label> & "text"');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("dragging a shape onto the canvas produces live Mermaid output", async ({ page, isMobile }) => {
  test.skip(isMobile, "Touch users add shapes by tapping; HTML drag-and-drop is a desktop gesture.");
  const editor = await openEditor(page);
  const nodes = editor.locator(".react-flow__node");
  const count = await nodes.count();
  await editor
    .getByRole("button", { name: "Process", exact: true })
    .dragTo(editor.locator(".react-flow__pane"), { targetPosition: { x: 80, y: 80 } });
  await expect(nodes).toHaveCount(count + 1);
  await expect(editor.locator(".cm-content")).toContainText('["New node"]');
});

test("invalid source preserves the last diagram and correcting it recovers", async ({ page }) => {
  const editor = await openEditor(page);
  await showCode(editor);
  await setSource(page, editor, 'flowchart LR\n subgraph Group\n A["Alpha"] --> B{"Beta?"}\n end\n B --> A');
  await expect(editor.locator('.react-flow__node[data-id="A"]')).toContainText("Alpha");
  await expect(editor.locator('.react-flow__node[data-id="Group"]')).toBeAttached();
  const validNodes = await editor.locator(".react-flow__node").count();
  await setSource(page, editor, 'flowchart LR\n A["Unfinished');
  await expect(editor.locator(".parse-error")).toBeVisible();
  await expect(editor.locator(".react-flow__node")).toHaveCount(validNodes);
  await setSource(page, editor, 'flowchart LR\n A["Recovered"]');
  await expect(editor.locator(".parse-error")).toHaveCount(0);
  await expect(editor.locator(".react-flow__node")).toHaveCount(1);
  await expect(editor.locator(".react-flow__node")).toContainText("Recovered");
});

test("Mermaid downloads reopen and SVG export works locally without automatic persistence", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    // Exercise the download/file-input path used by browsers without native file pickers.
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true });
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true });
  });
  const editor = await openEditor(page);
  await showCode(editor);
  const source = 'flowchart LR\n A["Saved café"] -->|"yes"| B{"Ready?"}';
  await setSource(page, editor, source);
  await expect(editor.locator(".react-flow__node")).toHaveCount(2);
  await showCanvas(editor);
  const saving = page.waitForEvent("download");
  await action(editor, "Save .mmd");
  const saved = await saving;
  expect(saved.suggestedFilename()).toMatch(/\.mmd$/);
  const file = await saved.path();
  if (!file) throw new Error("Mermaid download did not complete");
  const downloaded = await fs.readFile(file, "utf8");
  expect(downloaded).toContain("Saved café");
  expect(downloaded).toContain('B{"Ready?"}');
  await page.reload();
  await expect(page.locator("#mermaid-status")).toHaveText(copy.readyMessage);
  await expect(editor.locator(".cm-content")).not.toContainText("Saved café");
  const opening = page.waitForEvent("filechooser");
  await action(editor, "Open");
  await (
    await opening
  ).setFiles({ name: "saved.mmd", mimeType: "text/plain", buffer: Buffer.from(downloaded) });
  await expect(editor.locator(".cm-content")).toContainText("Saved café");
  await expect(editor.locator(".react-flow__node")).toHaveCount(2);
  await action(editor, "Export…");
  const dialog = editor.getByRole("dialog", { name: "Export diagram" });
  await dialog.getByRole("combobox", { name: "Format", exact: true }).selectOption("svg");
  await expect(dialog.getByRole("button", { name: "Export SVG", exact: true })).toBeEnabled();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await context.setOffline(true);
  const exporting = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export SVG", exact: true }).click();
  const image = await exporting;
  expect(image.suggestedFilename()).toMatch(/\.svg$/);
  const imagePath = await image.path();
  if (!imagePath) throw new Error("SVG export did not complete");
  expect(await fs.readFile(imagePath, "utf8")).toMatch(/<svg[\s>]/);
  await context.setOffline(false);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await editor.locator("body").evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test("full-screen expansion preserves the diagram and exits cleanly", async ({ page }) => {
  const editor = await openEditor(page);
  if (!(await page.evaluate(() => document.fullscreenEnabled))) return;
  await showCode(editor);
  await setSource(page, editor, 'flowchart TD\n A["Keep this diagram"]');
  await expect(editor.locator(".react-flow__node")).toHaveCount(1);
  await page.getByRole("button", { name: copy.fullscreenLabel, exact: true }).click();
  await expect(page.getByRole("button", { name: copy.exitFullscreenLabel })).toBeVisible();
  await expect(editor.locator(".cm-content")).toContainText("Keep this diagram");
  await page.getByRole("button", { name: copy.exitFullscreenLabel }).click();
  await expect(page.getByRole("button", { name: copy.fullscreenLabel })).toBeFocused();
  await expect(editor.locator(".cm-content")).toContainText("Keep this diagram");
});

test("the workspace is wide and instructions collapse without resetting the diagram", async ({ page }) => {
  const editor = await openEditor(page);
  const frame = page.locator("#mermaid-editor");
  const bounds = await frame.boundingBox();
  const viewport = page.viewportSize();
  if (!bounds || !viewport) throw new Error("Missing editor dimensions");
  expect(bounds.width).toBeGreaterThan(viewport.width * 0.9);
  expect(bounds.y).toBeLessThan(viewport.height * 0.55);
  await expect(page.locator(".mermaid-help")).toHaveJSProperty("open", false);
  await setSource(page, editor, 'flowchart LR\n A["Preserve while reading"]');
  await expect(editor.locator(".react-flow__node")).toHaveCount(1);
  const summary = page.getByText(copy.helpLabel, { exact: true });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(copy.instructions, { exact: true })).toBeVisible();
  await summary.press("Enter");
  await expect(page.getByText(copy.instructions, { exact: true })).toBeHidden();
  await expect(editor.locator(".cm-content")).toContainText("Preserve while reading");
});

test("recovery is opt-in and restores a draft without overwriting it at startup", async ({ page }) => {
  let editor = await openEditor(page);
  const source = 'flowchart LR\n A["Recover café 🚀"] --> B["Later"]';
  await setSource(page, editor, source);
  await expect(editor.locator(".react-flow__node")).toHaveCount(2);
  expect(await page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBeNull();
  await page.getByLabel(copy.recoveryLabel).check();
  await expect(page.locator("#mermaid-recovery-status")).toHaveText(copy.recoverySavedMessage);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBe(source);
  editor = await openEditor(page);
  await expect(page.locator("#mermaid-recovery-status")).toHaveText(copy.recoveryPendingMessage);
  await expect(page.getByLabel(copy.recoveryLabel)).toBeDisabled();
  await expect(editor.locator(".cm-content")).not.toContainText("Recover café");
  await page.getByRole("button", { name: copy.restoreLabel, exact: true }).click();
  await expect(editor.locator(".cm-content")).toContainText("Recover café");
  await expect(editor.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.getByLabel(copy.recoveryLabel)).toBeChecked();
  await setSource(page, editor, 'flowchart LR\n A["Unfinished');
  await expect(editor.locator(".parse-error")).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), recoveryKey))
    .toBe('flowchart LR\n A["Unfinished');
  await page.getByRole("button", { name: copy.forgetLabel, exact: true }).click();
  await expect(page.getByLabel(copy.recoveryLabel)).not.toBeChecked();
  expect(await page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBeNull();
  await expect(editor.locator(".cm-content")).toContainText("Unfinished");
  await page.getByLabel(copy.recoveryLabel).check();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), recoveryKey)).not.toBeNull();
  await page.getByLabel(copy.recoveryLabel).uncheck();
  expect(await page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBeNull();
});

test("oversize drafts and storage failures keep the previous recovery copy", async ({ page }) => {
  const editor = await openEditor(page);
  await page.getByLabel(copy.recoveryLabel).check();
  await expect(page.locator("#mermaid-recovery-status")).toHaveText(copy.recoverySavedMessage);
  const saved = await page.evaluate((key) => localStorage.getItem(key), recoveryKey);
  await editor.locator("body").evaluate((_element, limit) => {
    parent.postMessage({ type: "change", code: "x".repeat(limit + 1) }, location.origin);
  }, recoveryLimit);
  await expect(page.locator("#mermaid-recovery-status")).toHaveText(copy.recoveryLimitMessage);
  await expect(page.getByLabel(copy.recoveryLabel)).not.toBeChecked();
  expect(await page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBe(saved);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Storage full", "QuotaExceededError");
      original.call(this, name, value);
    };
  }, recoveryKey);
  await page.getByLabel(copy.recoveryLabel).check();
  await expect(page.locator("#mermaid-recovery-status")).toHaveText(copy.recoveryErrorMessage);
  expect(await page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBe(saved);
  await setSource(page, editor, 'flowchart LR\n A["Still editable"]');
  await expect(editor.locator(".react-flow__node")).toHaveCount(1);
});

test("a draft changed in another tab pauses local recovery", async ({ page, context }) => {
  const editor = await openEditor(page);
  await page.getByLabel(copy.recoveryLabel).check();
  await expect(page.locator("#mermaid-recovery-status")).toHaveText(copy.recoverySavedMessage);
  const other = await context.newPage();
  await other.goto("/tools/");
  const remote = 'flowchart LR\n A["Another tab"]';
  await other.evaluate(({ key, code }) => localStorage.setItem(key, code), {
    key: recoveryKey,
    code: remote,
  });
  await expect(page.locator("#mermaid-recovery-status")).toHaveText(copy.recoveryPendingMessage);
  await expect(page.getByLabel(copy.recoveryLabel)).not.toBeChecked();
  await setSource(page, editor, 'flowchart LR\n A["This tab"]');
  await expect(editor.locator(".react-flow__node")).toHaveCount(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), recoveryKey)).toBe(remote);
  await other.close();
});

test("blocked recovery storage does not prevent diagram editing", async ({ page }) => {
  await page.addInitScript((key) => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (name === key) throw new DOMException("Storage blocked", "SecurityError");
      return original.call(this, name);
    };
  }, recoveryKey);
  const editor = await openEditor(page);
  await expect(page.locator("#mermaid-recovery-status")).toHaveText(copy.recoveryErrorMessage);
  await setSource(page, editor, 'flowchart LR\n A["No storage needed"]');
  await expect(editor.locator(".react-flow__node")).toHaveCount(1);
});

test("failed editor loading reports an error and rejects unrelated ready messages", async ({ page }) => {
  await page.clock.install();
  await page.route("**/tools/mermaid/editor/assets/*.js", (route) => route.abort());
  await page.goto("/tools/mermaid/");
  await expect(page.locator("#mermaid-status")).toHaveText(copy.loadingMessage);
  await page.evaluate(() => window.postMessage({ type: "ready" }, location.origin));
  await page.clock.runFor(31_000);
  await expect(page.locator("#mermaid-status")).toHaveText(copy.loadErrorMessage);
  await expect(page.locator("#mermaid-fullscreen")).toBeDisabled();
});

test("the embedded editor blocks external requests and reports bridge errors as text", async ({ page }) => {
  let externalReachedNetwork = false;
  await page.route("https://external.invalid/**", (route) => {
    externalReachedNetwork = true;
    return route.abort();
  });
  const editor = await openEditor(page);
  const blocked = await editor.locator("body").evaluate(async () => {
    try {
      await fetch("https://external.invalid/icon.svg");
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
  expect(externalReachedNetwork).toBe(false);
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#mermaid-editor");
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://external.invalid",
        source: frame?.contentWindow,
        data: { type: "error", message: "Untrusted error" },
      }),
    );
  });
  await expect(page.locator("#mermaid-status")).toHaveText(copy.readyMessage);
  await editor.locator("body").evaluate(() => {
    parent.postMessage({ type: "error", message: "<img src=x> & error" }, location.origin);
  });
  await expect(page.locator("#mermaid-status")).toHaveText(`${copy.editorErrorMessage} <img src=x> & error`);
  await expect(page.locator("#mermaid-status img")).toHaveCount(0);
});

test.describe("Mermaid without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("guidance stays visible and does not load the editor", async ({ page }) => {
    await page.goto("/tools/mermaid/");
    await expect(page.getByRole("heading", { name: copy.heading, exact: true })).toBeVisible();
    await expect(page.locator("#mermaid-status")).toHaveText(copy.noScriptMessage);
    await expect(page.locator("#mermaid-editor")).toBeHidden();
    await expect(page.locator("#mermaid-editor")).not.toHaveAttribute("src");
  });
});
