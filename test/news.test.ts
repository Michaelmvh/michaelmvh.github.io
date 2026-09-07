import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { renderNews } from "../scripts/news.ts";
import { output, readJson } from "../scripts/site.ts";
import type { NewsEntry, Pages } from "../scripts/types.ts";

test("news sorts newest-first, preserves ties, and does not mutate input", () => {
  const entries: NewsEntry[] = [
    { id: "older", date: "2024", text: "An older milestone." },
    { id: "newer", date: "2026-09", text: "A newer milestone." },
    { id: "same-month", date: "2026-09", text: "Another milestone." },
    { id: "specific-day", date: "2026-09-07", text: "A dated milestone." },
  ];
  const original = structuredClone(entries);
  const html = renderNews(entries, "News");
  const ids = [...html.matchAll(/<li id="news-([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["specific-day", "newer", "same-month", "older"]);
  assert.deepEqual(entries, original);
});

test("news preserves date precision and calendar days in Pacific time", () => {
  for (const [date, label] of [
    ["2024", "2024"],
    ["2026-09", "Sep 2026"],
    ["2026-09-07", "Sep 7, 2026"],
    ["2026-01-01", "Jan 1, 2026"],
    ["2026-07-01", "Jul 1, 2026"],
    ["2024-02-29", "Feb 29, 2024"],
  ]) {
    assert.ok(date && label);
    const html = renderNews([{ id: "milestone", date, text: "An achievement." }], "News");
    assert.ok(html.includes(`<time datetime="${date}">${label}</time>`));
  }
});

test("news escapes authored text and headings", () => {
  const html = renderNews(
    [{ id: "milestone", date: "2026", text: '<script>alert("news")</script> & more' }],
    "News & <updates>",
  );
  assert.ok(html.includes("News &amp; &lt;updates&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(&quot;news&quot;)&lt;/script&gt; &amp; more"));
  assert.ok(!html.includes("<script>"));
});

test("an empty news collection does not render an empty section", () => {
  assert.equal(renderNews([], "News"), "");
});

test("homepage includes the generated news between the hero and the story", async () => {
  const entries = await readJson<NewsEntry[]>("data/news.json");
  const pages = await readJson<Pages>("data/pages.json");
  const html = await fs.readFile(path.join(output, "index.html"), "utf8");
  assert.ok(html.includes(renderNews(entries, pages.home.newsHeading)));
  assert.ok(!html.includes("<!-- Recent news from news.json -->"));
  if (entries.length > 0) {
    const section = html.indexOf('class="recent-news"');
    assert.ok(section > html.indexOf('class="hero"'));
    assert.ok(section < html.indexOf('class="home-story"'));
  }
});
