import assert from "node:assert/strict";
import test from "node:test";
import { loadSiteData } from "../scripts/data.ts";
import { createLayout, renderSitemap } from "../scripts/rendering/layout.ts";
import { createPortfolioRenderer } from "../scripts/rendering/portfolio.ts";
import { escapeHtml } from "../scripts/site.ts";
import type { Publication } from "../src/shared/content.ts";

test("optional introductions render escaped copy independently of authored content", async () => {
  const { pages } = await loadSiteData();
  const fragment =
    "<header><!-- Optional pages.json home introduction --></header><!-- Recent news from news.json -->";
  for (const introduction of ["", 'An introduction with <markup>, "quotes", and $&.']) {
    for (const page of [pages.home, pages.publications, pages.baking, pages.other]) {
      page.introduction = introduction;
    }
    const renderer = createPortfolioRenderer(pages, []);
    for (const html of [
      renderer.renderHome(fragment),
      renderer.renderPublications([]),
      renderer.renderBaking([]),
      renderer.renderOther([]),
    ]) {
      assert.doesNotMatch(html, /<!--|<markup>/);
      if (introduction) assert.ok(html.includes(escapeHtml(introduction)));
      else assert.doesNotMatch(html, /<p(?: class="hero-lede")?><\/p>/);
    }
  }
  const renderer = createPortfolioRenderer(pages, []);
  assert.throws(() => renderer.renderHome(""), /introduction marker/);
  assert.throws(() => renderer.renderHome("<!-- Optional pages.json home introduction -->"), /news marker/);
});

test("publication rendering supports empty and multiple records with configured labels", async () => {
  const { pages } = await loadSiteData();
  pages.publications.copyLabel = "Copy this reference";
  pages.publications.copiedMessage = "Reference <copied> & ready";
  const renderer = createPortfolioRenderer(pages, []);
  const publication: Publication = {
    id: "example",
    title: "Example paper",
    authors: "Example author",
    venue: "Example journal",
    volume: "1",
    year: 2026,
    doi: "10.1234/example",
    pdf: "/assets/documents/example.pdf",
    citation: 'A reference with "quotes" & markup <here>',
  };
  for (const entries of [[], [publication], [publication, { ...publication, id: "second" }]]) {
    const html = renderer.renderPublications(entries);
    assert.equal((html.match(/class="citation-button"/g) ?? []).length, entries.length);
    if (entries.length) {
      assert.ok(html.includes(escapeHtml(publication.citation)));
      assert.ok(html.includes(`>${pages.publications.copyLabel}</button>`));
      assert.ok(html.includes(`data-copied-message="${escapeHtml(pages.publications.copiedMessage)}"`));
    }
  }
});

test("gallery rendering supports absent and present captions without production-content assumptions", async () => {
  const { pages } = await loadSiteData();
  const renderer = createPortfolioRenderer(pages, []);
  for (const caption of [undefined, 'A caption with "quotes" & <markup>']) {
    const html = renderer.renderOther([
      {
        id: "example",
        title: "Example gallery",
        description: "A fixture gallery.",
        images: [
          {
            id: "image",
            image: "/assets/images/example.jpg",
            alt: "Example",
            width: 800,
            height: 600,
            caption,
          },
        ],
      },
    ]);
    if (caption) assert.ok(html.includes(`data-lightbox-caption="${escapeHtml(caption)}"`));
    else assert.doesNotMatch(html, /data-lightbox-caption=/);
    assert.equal((html.match(/<dialog /g) ?? []).length, 1);
  }
});

test("layout uses supplied identity, shared labels, metadata, and analytics policy", async () => {
  const { site, pages } = await loadSiteData();
  site.name = "Example & <Author>";
  site.wordmark = ["Example", "<Author>"];
  site.knowsAbout = ["A <topic>"];
  pages.shared.menuLabel = "Explore & <navigate>";
  const layout = createLayout(site, pages.shared, 2030);
  const page = { id: "home", route: "", title: "Home", description: "An example.", content: "<h1>Home</h1>" };
  const html = layout(page);
  assert.ok(html.includes(`<title>${escapeHtml(site.name)}</title>`));
  assert.ok(html.includes("<span>Example</span> <span>&lt;Author&gt;</span>"));
  assert.ok(html.includes(escapeHtml(pages.shared.menuLabel)));
  assert.ok(html.includes(`© 2030 ${escapeHtml(site.name)}`));
  const schemaText = html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/)?.[1];
  assert.ok(schemaText);
  const schema: unknown = JSON.parse(schemaText);
  assert.ok(typeof schema === "object" && schema !== null && "knowsAbout" in schema);
  assert.deepEqual(schema.knowsAbout, site.knowsAbout);
  assert.match(html, /googletagmanager\.com/);
  const tool = layout({ ...page, id: "tool-example", route: "tools/example", analytics: false });
  assert.doesNotMatch(tool, /googletagmanager\.com/);
  assert.ok(tool.includes(`href="${site.siteUrl}/tools/example/"`));
  assert.ok(tool.includes('href="/tools/apple-touch-icon.png"'));
  assert.ok(renderSitemap(["", "projects"], site.siteUrl).includes(`<loc>${site.siteUrl}/projects/</loc>`));
});
