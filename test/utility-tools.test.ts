import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  inspectUrl,
  isTrackingParameter,
  maximumUrlLength,
  maximumUrlParameters,
  serializeUrl,
  UrlInputError,
} from "../src/client/url-inspector-model.ts";
import { countText, transformText } from "../src/client/text-utilities-model.ts";
import type { TextOptions } from "../src/client/text-utilities-model.ts";
import { DocumentInputError, maximumCharacters, maximumLines } from "../src/client/document-limits.ts";
import { output, readJson } from "../scripts/site.ts";
import type { Pages } from "../scripts/types.ts";
import { renderTextUtilities, renderUrlInspector } from "../scripts/utility-tools.ts";

const unchanged: TextOptions = {
  letterCase: "unchanged",
  sort: "none",
  trimLines: false,
  removeBlank: false,
  deduplicate: false,
};

test("URL inspection preserves untouched query syntax, order, duplicates, and fragments", () => {
  for (const source of [
    "https://example.com/path?a=1&a=2&bare&empty=&=value&&q=a+b&other=a%20b&encoded=%2f#anchor",
    "https://example.com/?q=O'Reilly",
    "https://example.com/?q=O'Reilly&space=a b&unicode=café#anchor?not=a&parameter=b",
    "https://example.com/#anchor?not=a&parameter=b",
    "https://example.com/?#",
    "https://example.com/#",
    "https://example.com/?",
    "https://name:secret@example.com:8443/path?url=https%3A%2F%2Fother.test%2F%3Fa%3D1",
  ]) {
    assert.equal(serializeUrl(inspectUrl(source)), source);
  }
  const parsed = inspectUrl("https://example.com/?x=a+b&x=%2B&unicode=caf%C3%A9&nl=%0A&nested=%2520");
  assert.deepEqual(
    parsed.parameters.map(({ name, value }) => [name, value]),
    [
      ["x", "a b"],
      ["x", "+"],
      ["unicode", "café"],
      ["nl", "\n"],
      ["nested", "%20"],
    ],
  );
  const first = parsed.parameters[0];
  assert.ok(first);
  first.name = "a & b";
  first.value = "one+two / 🚀";
  delete first.raw;
  assert.equal(
    serializeUrl(parsed),
    "https://example.com/?a%20%26%20b=one%2Btwo%20%2F%20%F0%9F%9A%80&x=%2B&unicode=caf%C3%A9&nl=%0A&nested=%2520",
  );
});

test("URL inspection preserves original query segments through normalization and neighboring edits", () => {
  const parsed = inspectUrl("  HTTPS://EXAMPLE.COM:443/a/../b?q=O'Reilly&edit=old#anchor  ");
  assert.equal(serializeUrl(parsed), "https://example.com/b?q=O'Reilly&edit=old#anchor");
  assert.deepEqual(parsed.parameters[0], { raw: "q=O'Reilly", name: "q", value: "O'Reilly" });
  const edited = parsed.parameters[1];
  assert.ok(edited);
  edited.value = "new value";
  delete edited.raw;
  assert.equal(serializeUrl(parsed), "https://example.com/b?q=O'Reilly&edit=new%20value#anchor");
});

test("URL normalization and tracking recognition are explicit and conservative", () => {
  assert.equal(serializeUrl(inspectUrl("  HTTPS://EXAMPLE.COM:443/a/../b  ")), "https://example.com/b");
  for (const name of ["utm_source", "UTM_Medium", "fbclid", "gclid", "_ga"])
    assert.ok(isTrackingParameter(name));
  for (const name of ["ref", "source", "q", "id", "not_utm_source", ""])
    assert.equal(isTrackingParameter(name), false);
  assert.ok(isTrackingParameter(inspectUrl("https://e.test/?%75tm_source=x").parameters[0]!.name));
});

test("URL inspection rejects invalid protocols, malformed encoding, and oversized edits", () => {
  for (const source of [
    "not a URL",
    "//example.com",
    "javascript:alert(1)",
    "data:text/html,x",
    "ftp://e.test",
    "https://",
    "https://e.\ntest",
  ]) {
    assert.throws(
      () => inspectUrl(source),
      (error) => error instanceof UrlInputError && error.kind === "invalid",
    );
  }
  for (const source of ["https://e.test/?x=%", "https://e.test/?%ZZ=x", "https://e.test/?x=%FF"]) {
    assert.throws(
      () => inspectUrl(source),
      (error) => error instanceof UrlInputError && error.kind === "encoding",
    );
  }
  const prefix = "https://e.test/?x=";
  assert.equal(
    serializeUrl(inspectUrl(prefix + "a".repeat(maximumUrlLength - prefix.length))).length,
    maximumUrlLength,
  );
  assert.throws(() => inspectUrl(prefix + "a".repeat(maximumUrlLength)), UrlInputError);
  const parsed = inspectUrl("https://e.test/?" + Array(maximumUrlParameters).fill("x=").join("&"));
  parsed.parameters.push({ name: "extra", value: "" });
  assert.throws(() => serializeUrl(parsed), UrlInputError);
  assert.throws(
    () =>
      inspectUrl(
        "https://e.test/?" +
          Array(maximumUrlParameters + 1)
            .fill("x=")
            .join("&"),
      ),
    UrlInputError,
  );
  assert.throws(
    () => serializeUrl({ ...parsed, parameters: [{ name: "x", value: "\ud800" }] }),
    (error) => error instanceof UrlInputError && error.kind === "encoding",
  );
  assert.throws(
    () => serializeUrl({ ...parsed, parameters: [{ name: "x", value: "é".repeat(3_000) }] }),
    (error) => error instanceof UrlInputError && error.kind === "limit",
  );
});

test("text transformations compose in the documented order without altering the source", () => {
  const input = " Zebra \r\napple\nAPPLE\n  \n Zebra \n";
  assert.equal(
    transformText(input, {
      letterCase: "lower",
      trimLines: true,
      removeBlank: true,
      deduplicate: true,
      sort: "ascending",
    }),
    "apple\nzebra\n",
  );
  assert.equal(input, " Zebra \r\napple\nAPPLE\n  \n Zebra \n");
  assert.equal(transformText("10\n2\nA\na", { ...unchanged, sort: "ascending" }), "10\n2\nA\na");
  assert.equal(transformText("10\n2\nA\na", { ...unchanged, sort: "descending" }), "a\nA\n2\n10");
  assert.equal(transformText("a\nA\na", { ...unchanged, deduplicate: true }), "a\nA");
  assert.equal(transformText("é Straße", { ...unchanged, letterCase: "upper" }), "É STRASSE");
  assert.equal(transformText(" A \rB\r\n", unchanged), " A \nB\n");
});

test("word capitalization handles mixed case, Unicode, punctuation, and whitespace", () => {
  const options: TextOptions = { ...unchanged, letterCase: "capitalize" };
  assert.equal(
    transformText("text WHERE every FIRST letter IS capitalized", options),
    "Text Where Every First Letter Is Capitalized",
  );
  assert.equal(
    transformText("  ÉCOLE\tde\u0301jà VU!\nDON'T stop-now. 👩‍👩‍👧‍👦\n", options),
    "  École\tDe\u0301jà Vu!\nDon't Stop-Now. 👩‍👩‍👧‍👦\n",
  );
  assert.equal(
    transformText("hello WORLD\nHELLO world\n", { ...options, deduplicate: true }),
    "Hello World\n",
  );
  assert.equal(transformText("", options), "");
});

test("text transformations preserve final newlines and handle empty and whitespace-only results", () => {
  for (const input of ["", "\n", "\n\n", "a", "a\n", "a\n\n"]) {
    assert.equal(transformText(input, unchanged), input);
  }
  assert.equal(transformText(" \n\t\n", { ...unchanged, removeBlank: true }), "");
  assert.equal(transformText("a\n\n", { ...unchanged, removeBlank: true }), "a\n");
  assert.equal(transformText("\n\n", { ...unchanged, deduplicate: true }), "\n");
  assert.equal(transformText("   ", { ...unchanged, trimLines: true }), "");
});

test("Unicode counts use graphemes, word boundaries, and logical lines", () => {
  assert.deepEqual(countText(""), { characters: 0, words: 0, lines: 0 });
  assert.deepEqual(countText("e\u0301 👩‍👩‍👧‍👦\r\n"), { characters: 4, words: 1, lines: 1 });
  assert.deepEqual(countText("Hello world\nnext"), { characters: 16, words: 3, lines: 2 });
  assert.deepEqual(countText("\n\n"), { characters: 2, words: 0, lines: 2 });
});

test("text limits cover input, expanded output, and newline counts", () => {
  assert.equal(transformText("a".repeat(maximumCharacters), unchanged).length, maximumCharacters);
  assert.throws(() => transformText("a".repeat(maximumCharacters + 1), unchanged), DocumentInputError);
  assert.throws(
    () => transformText("ß".repeat(maximumCharacters), { ...unchanged, letterCase: "upper" }),
    DocumentInputError,
  );
  assert.equal(
    transformText(Array(maximumLines).fill("a").join("\n"), unchanged).split("\n").length,
    maximumLines,
  );
  assert.throws(() => countText("\n".repeat(maximumLines)), DocumentInputError);
});

test("utility pages use local isolated scripts and escape authored copy", async () => {
  const pages = await readJson<Pages>("data/pages.json");
  for (const [slug, entry, forbidden] of [
    ["url-inspector", "url-inspector", "text-utilities"],
    ["text-utilities", "text-utilities", "url-inspector"],
  ]) {
    const html = await fs.readFile(path.join(output, `tools/${slug}/index.html`), "utf8");
    assert.match(html, new RegExp(`src="/assets/js/${entry}.js"`));
    assert.ok(!html.includes(`/assets/js/${forbidden}.js`));
    assert.doesNotMatch(html, /qrcode-generator|document-tools.js|mermaid-tool.js/);
    assert.match(html, /<fieldset id="utility-controls" disabled>/);
  }
  for (const html of [
    renderUrlInspector({ ...pages.urlInspector, inputLabel: '<script>"&' }, pages.tools.backLabel),
    renderTextUtilities({ ...pages.textUtilities, inputLabel: '<script>"&' }, pages.tools.backLabel),
  ]) {
    assert.match(html, /&lt;script&gt;&quot;&amp;/);
    assert.doesNotMatch(html, /<script>"&/);
    assert.match(html, /\\u003cscript>/);
  }
});
