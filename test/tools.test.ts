import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml, output, readJson } from "../scripts/site.ts";
import type { Pages, Site, Tool } from "../scripts/types.ts";
import { renderTools } from "../scripts/tools.ts";

test("tools are unlisted, noindex, analytics-free, and use local scripts", async () => {
  const tools = await readJson<Tool[]>("data/tools.json");
  const site = await readJson<Site>("data/site.json");
  const index = await fs.readFile(path.join(output, "tools/index.html"), "utf8");
  assert.doesNotMatch(
    index,
    /qr-code.js|qrcode-generator|document-tools.js|mermaid-tool.js|<iframe|<textarea/,
  );
  for (const tool of tools) {
    assert.ok(index.includes(`href="/tools/${tool.slug}/"`));
    assert.ok(index.includes(escapeHtml(tool.name)));
    assert.ok(index.includes(escapeHtml(tool.description)));
  }
  for (const route of ["tools", ...tools.map((tool) => `tools/${tool.slug}`)]) {
    const html = await fs.readFile(path.join(output, route, "index.html"), "utf8");
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.doesNotMatch(html, /googletagmanager|gtag\(/);
    assert.ok(html.includes(`href="${site.siteUrl}/${route}/"`));
    if (route !== "tools") assert.match(html, /href="\/tools\/"/);
  }
  const qr = await fs.readFile(path.join(output, "tools/qr-code/index.html"), "utf8");
  assert.match(qr, /type="module" src="\/assets\/js\/qr-code.js"/);
  assert.match(qr, /"qrcode-generator":"\/assets\/js\/vendor\/qrcode.mjs"/);
  await fs.access(path.join(output, "assets/js/vendor/qrcode.mjs"));
  await fs.access(path.join(output, "assets/js/vendor/diff-LICENSE.txt"));
  await fs.access(path.join(output, "assets/js/vendor/jsonc-parser-LICENSE.txt"));
  for (const slug of ["json", "text-diff"]) {
    const html = await fs.readFile(path.join(output, `tools/${slug}/index.html`), "utf8");
    assert.match(html, /type="module" src="\/assets\/js\/document-tools.js"/);
    assert.doesNotMatch(html, /qr-code.js|qrcode-generator/);
  }
  assert.doesNotMatch(qr, /document-tools.js/);
  assert.ok(site.navigation.every((item) => !item.url.startsWith("/tools")));
  const sitemap = await fs.readFile(path.join(output, "sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /\/tools(?:\/|<)/);
  const robots = await fs.readFile(path.join(output, "robots.txt"), "utf8");
  assert.doesNotMatch(robots, /Disallow:.*tools/);

  for await (const file of fs.glob("**/*.html", { cwd: output })) {
    if (file.startsWith("tools/")) continue;
    const publicPage = await fs.readFile(path.join(output, file), "utf8");
    assert.doesNotMatch(publicPage, /href="\/tools(?:\/|")/, `${file} links to unlisted tools`);
    assert.doesNotMatch(
      publicPage,
      /assets\/js\/(?:tools|qr-code|document-tools|mermaid-tool).js|qrcode-generator/,
    );
  }
});

test("the directory renders and escapes every registered tool", async () => {
  const pages = await readJson<Pages>("data/pages.json");
  const tools = [
    { slug: "first", name: "First <tool>", description: 'A "useful" utility & more.' },
    { slug: "second", name: "Second tool", description: "Another utility." },
  ];
  const html = renderTools(pages.tools, tools);
  for (const tool of tools) {
    assert.ok(html.includes(`href="/tools/${tool.slug}/"`));
    assert.ok(html.includes(escapeHtml(tool.name)));
    assert.ok(html.includes(escapeHtml(tool.description)));
  }
  assert.doesNotMatch(html, /First <tool>/);
});
