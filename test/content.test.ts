import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { output, readJson, resolveWithin, source, validateSiteData } from "../scripts/site.ts";
import type { Bake, IndexPageCopy, Pages, Project, Publication, Site, SiteData } from "../scripts/types.ts";

test("content validation rejects unsafe paths and malformed nested values", async () => {
  const unsafeSlug = await readSiteData();
  const firstUnsafeProject = unsafeSlug.projects[0];
  assert.ok(firstUnsafeProject);
  firstUnsafeProject.slug = "../../outside";
  assert.throws(() => validateSiteData(unsafeSlug), /slug must use lowercase letters, numbers, and hyphens/);

  const malformedTags = await readSiteData();
  const firstMalformedProject = malformedTags.projects[0];
  assert.ok(firstMalformedProject);
  (firstMalformedProject as unknown as { tags: unknown }).tags = "machine-learning";
  assert.throws(() => validateSiteData(malformedTags), /tags must be an array/);

  assert.throws(() => resolveWithin(output, "../outside"), /Path escapes/);
});

test("navigation references valid internal pages", async () => {
  const site = await readJson<Site>("data/site.json");
  for (const item of site.navigation.filter((entry) => !entry.external)) {
    const relative = item.url === "/" ? "index.html" : path.join(item.url, "index.html");
    await fs.access(path.join(output, relative));
  }
});

test("every project and bake has generated detail content", async () => {
  const projects = await readJson<Project[]>("data/projects.json");
  const baking = await readJson<Bake[]>("data/baking.json");
  const collections: Array<["projects" | "bakes", Array<Project | Bake>]> = [
    ["projects", projects],
    ["bakes", baking],
  ];
  for (const [section, entries] of collections) {
    for (const entry of entries) {
      const html = await fs.readFile(path.join(output, section, entry.slug, "index.html"), "utf8");
      assert.match(html, new RegExp(entry.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});

test("project images stay within the asset size budget", async () => {
  const projects = await readJson<Project[]>("data/projects.json");
  const maximumImageSize = 1024 * 1024;

  for (const project of projects) {
    const image = path.join(source, project.image.replace(/^\//, ""));
    const { size } = await fs.stat(image);
    assert.ok(
      size <= maximumImageSize,
      `${project.image} is ${(size / 1024).toFixed(0)} KiB; project images must not exceed 1 MiB`,
    );
  }
});

test("generated pages include accessibility and metadata essentials", async () => {
  const html = await fs.readFile(path.join(output, "index.html"), "utf8");
  assert.match(html, /<main id="main">/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-label="Main navigation"/);
  assert.match(html, /<meta name="description"/);
  assert.match(html, /<link rel="canonical"/);
});

test("homepage serves responsive optimized portrait images", async () => {
  const html = await fs.readFile(path.join(output, "index.html"), "utf8");
  assert.match(html, /<picture>/);
  assert.match(
    html,
    /srcset="\/assets\/images\/profile-400\.webp 400w, \/assets\/images\/profile-800\.webp 800w"/,
  );
  assert.match(html, /sizes="\(max-width: 800px\) 80vw, 23rem"/);
  assert.match(
    html,
    /src="\/assets\/images\/profile\.jpg"\s+alt="Michael Vanden Heuvel"\s+width="1000"\s+height="1000"/,
  );

  const variants = [
    ["profile-400.webp", 20 * 1024],
    ["profile-800.webp", 40 * 1024],
  ] as const;
  for (const [file, maximumSize] of variants) {
    const image = path.join(output, "assets", "images", file);
    const { size } = await fs.stat(image);
    assert.ok(size <= maximumSize, `${file} must not exceed ${maximumSize / 1024} KiB`);
    const expectedWidth = Number.parseInt(file.match(/\d+/)?.[0] ?? "", 10);
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.width, expectedWidth);
    assert.equal(metadata.height, expectedWidth);
    assert.equal(metadata.format, "webp");
  }
});

test("page-level copy comes from the central page data", async () => {
  const pages = await readJson<Pages>("data/pages.json");
  assert.equal(typeof pages._instructions.fields.introduction, "string");
  assert.equal(pages.home.introduction, "");
  assert.equal(pages.publications.introduction, "");
  assert.equal(pages.baking.introduction, "");

  const home = await fs.readFile(path.join(output, "index.html"), "utf8");
  assert.doesNotMatch(home, /Optional pages\.json home introduction/);

  const indexPages: Array<[string, IndexPageCopy]> = [
    ["publications", pages.publications],
    ["projects", pages.projects],
    ["baking", pages.baking],
  ];
  for (const [route, page] of indexPages) {
    const html = await fs.readFile(path.join(output, route, "index.html"), "utf8");
    assert.match(html, new RegExp(page.heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, new RegExp(page.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("CSS partials compile into one generated stylesheet", async () => {
  const html = await fs.readFile(path.join(output, "index.html"), "utf8");
  assert.equal(html.match(/rel="stylesheet"/g)?.length, 1);
  assert.match(html, /href="\/assets\/css\/site\.css"/);

  const css = await fs.readFile(path.join(output, "assets", "css", "site.css"), "utf8");
  assert.match(css, /:root \{/);
  assert.match(css, /html\[data-site-theme="blueprint"\]/);
  assert.match(css, /html\[data-site-theme="scifi"\]/);
  assert.doesNotMatch(css, /body\[data-page="style-scifi-paperback"\]/);
  assert.match(css, /@media \(max-width: 800px\)/);
});

test("homepage reflects the current doctoral program", async () => {
  const html = await fs.readFile(path.join(output, "index.html"), "utf8");
  assert.match(html, /CSE PhD student/);
  assert.match(html, /Jeff Nivala/);
  assert.match(html, /cs\.washington\.edu\/people\/faculty\/jeff-nivala/);
  assert.match(html, /Before graduate school/);
  assert.doesNotMatch(html, /\bincoming\b/i);
  assert.doesNotMatch(html, /I build computational tools for questions rooted in biology/);
});

test("live alternate themes have accessible persistent controls", async () => {
  const home = await fs.readFile(path.join(output, "index.html"), "utf8");
  assert.doesNotMatch(home, /data-site-theme="blueprint"/);
  assert.match(home, /data-site-theme="scifi" aria-pressed="false"/);
  assert.match(home, /data-theme-reset hidden/);
  assert.match(home, /localStorage\.getItem\("site-theme"\)/);

  const publications = await fs.readFile(path.join(output, "publications", "index.html"), "utf8");
  assert.match(publications, /data-theme-reset hidden/);

  const script = await fs.readFile(path.join(output, "assets", "js", "site.js"), "utf8");
  assert.match(script, /theme === "blueprint" \|\| theme === "scifi"/);
  assert.match(script, /localStorage\.setItem\(siteThemeKey, theme\)/);
  assert.match(script, /localStorage\.removeItem\(siteThemeKey\)/);
});

test("research stays dormant until it is ready to publish", async () => {
  await assert.rejects(fs.access(path.join(output, "research", "index.html")));

  const sitemap = await fs.readFile(path.join(output, "sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /\/research\//);

  const files = await collectHtml(output);
  for (const file of files) {
    const html = await fs.readFile(file, "utf8");
    assert.doesNotMatch(html, /href="\/research\/"/);
  }
});

test("projects are publicly discoverable", async () => {
  const site = await readJson<Site>("data/site.json");
  assert.equal(
    site.navigation.some((entry) => entry.url === "/projects/"),
    true,
  );

  const home = await fs.readFile(path.join(output, "index.html"), "utf8");
  assert.match(home, /href="\/projects\//);

  const sitemap = await fs.readFile(path.join(output, "sitemap.xml"), "utf8");
  assert.match(sitemap, /\/projects\//);

  const projectIndex = await fs.readFile(path.join(output, "projects", "index.html"), "utf8");
  assert.doesNotMatch(projectIndex, /<meta name="robots" content="noindex/);

  const projects = await readJson<Project[]>("data/projects.json");
  for (const project of projects) {
    const html = await fs.readFile(path.join(output, "projects", project.slug, "index.html"), "utf8");
    assert.doesNotMatch(html, /<meta name="robots" content="noindex/);
    assert.match(sitemap, new RegExp(`/projects/${project.slug}/`));
  }
});

test("Microsoft projects have a dedicated filter and public sources", async () => {
  const projects = await readJson<Project[]>("data/projects.json");
  const microsoftProjects = projects.filter((project) => project.category === "microsoft");
  assert.deepEqual(
    microsoftProjects.map((project) => project.slug),
    ["sentinel-data-transformations", "sentinel-repositories"],
  );

  const index = await fs.readFile(path.join(output, "projects", "index.html"), "utf8");
  assert.match(index, /data-filter="microsoft"/);

  for (const project of microsoftProjects) {
    assert.ok(project.links.length > 0);
    assert.ok(
      project.links.every(({ url }) => {
        const host = new URL(url).hostname;
        return (
          host === "learn.microsoft.com" ||
          host === "techcommunity.microsoft.com" ||
          host === "www.microsoft.com"
        );
      }),
    );
  }
});

test("private style previews are generated and excluded from indexing", async () => {
  const routes = ["biotech-blueprint"];

  for (const route of routes) {
    const html = await fs.readFile(path.join(output, "style-options", route, "index.html"), "utf8");
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(
      html,
      new RegExp(`<link rel="canonical" href="https://michaelmvh.com/style-options/${route}/">`),
    );
  }

  const styleOptionsEntries = await fs.readdir(path.join(output, "style-options"), { withFileTypes: true });
  const generatedRoutes = styleOptionsEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(generatedRoutes, [...routes].sort());

  const index = await fs.readFile(path.join(output, "style-options", "index.html"), "utf8");
  assert.doesNotMatch(index, /href="\/style-options\/scifi-paperback\/"/);
  assert.match(index, /href="\/style-options\/biotech-blueprint\/"/);
  assert.doesNotMatch(index, /href="\/style-options\/(?!biotech-blueprint\/)[^"]+\/"/);
});

test("all generated root-relative links resolve in the artifact", async () => {
  const files = await collectHtml(output);
  for (const file of files) {
    const html = await fs.readFile(file, "utf8");
    for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]+)"/g)) {
      const target = match[1];
      if (!target) throw new Error(`Unable to parse root-relative URL in ${file}`);
      const relative = target.endsWith("/") ? `${target}index.html` : target;
      await assert.doesNotReject(
        fs.access(path.join(output, relative)),
        `${path.relative(output, file)} references missing ${target}`,
      );
    }
  }
});

async function collectHtml(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectHtml(target)));
    else if (entry.name.endsWith(".html")) files.push(target);
  }
  return files;
}

async function readSiteData(): Promise<SiteData> {
  return {
    site: await readJson<Site>("data/site.json"),
    pages: await readJson<Pages>("data/pages.json"),
    projects: await readJson<Project[]>("data/projects.json"),
    publications: await readJson<Publication[]>("data/publications.json"),
    baking: await readJson<Bake[]>("data/baking.json"),
  };
}
