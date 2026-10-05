import { loadSiteData } from "../scripts/data.ts";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml, output, root } from "../scripts/site.ts";
import { mermaidEditorRoute, renderMermaid } from "../scripts/mermaid.ts";

test("Mermaid embeds a pinned local build without shipping public upstream pages", async () => {
  const html = await fs.readFile(path.join(output, "tools/mermaid/index.html"), "utf8");
  assert.match(html, /src="\/assets\/js\/mermaid-tool.js"/);
  assert.match(html, /data-editor-path="\/tools\/mermaid\/editor\/"/);
  assert.match(html, /sandbox="allow-scripts allow-same-origin allow-downloads"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  const editor = path.join(output, mermaidEditorRoute);
  const shell = await fs.readFile(path.join(editor, "index.html"), "utf8");
  assert.match(shell, /name="robots" content="noindex, nofollow"/);
  assert.match(shell, /connect-src 'self';/);
  assert.match(shell, /img-src 'self' data: blob:;/);
  assert.doesNotMatch(shell, /https?:|googletagmanager|gtag\(/);
  const entry = shell.match(/src="(\.\/assets\/[-\w]+\.js)"/)?.[1];
  assert.ok(entry);
  const packageRoot = path.join(root, "node_modules/archyne");
  assert.deepEqual(
    await fs.readFile(path.join(editor, entry)),
    await fs.readFile(path.join(packageRoot, "dist", entry)),
  );
  for (const [original, copied] of [
    ["LICENSE", "LICENSE.txt"],
    ["NOTICE", "NOTICE.txt"],
    ["THIRD-PARTY-NOTICES.md", "THIRD-PARTY-NOTICES.txt"],
  ] as const) {
    assert.deepEqual(
      await fs.readFile(path.join(packageRoot, original)),
      await fs.readFile(path.join(editor, copied)),
    );
  }
  await assert.rejects(fs.access(path.join(editor, "embed-demo.html")), { code: "ENOENT" });
});

test("Mermaid guidance and accessible iframe copy are escaped", async () => {
  const { pages } = await loadSiteData();
  const value = 'A <diagram> & "editor"';
  const html = renderMermaid(
    { ...pages.mermaid, instructions: value, editorLabel: value, loadErrorMessage: value },
    pages.tools.backLabel,
  );
  assert.match(html, /<iframe[^>]+title=/);
  assert.ok(html.includes(`title="${escapeHtml(value)}"`));
  assert.ok(html.includes(`<p>${escapeHtml(value)}</p>`));
  assert.ok(html.includes(`data-load-error-message="${escapeHtml(value)}"`));
  assert.ok(html.includes(escapeHtml(pages.mermaid.noScriptMessage)));
});
