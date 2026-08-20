import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  generateResponsiveImages,
  imageVariantPath,
  otherImageWidths,
  prepareOtherSections,
} from "./images.ts";
import {
  assert,
  escapeHtml,
  output,
  readContent,
  readJson,
  resolveWithin,
  root,
  source,
  validateSiteData,
} from "./site.ts";
import type { PreparedOtherImage, PreparedOtherSection } from "./images.ts";
import type { Bake, OtherSection, Page, Project, Publication, SiteData } from "./types.ts";

const data: SiteData = {
  site: await readJson<SiteData["site"]>("data/site.json"),
  pages: await readJson<SiteData["pages"]>("data/pages.json"),
  projects: await readJson<Project[]>("data/projects.json"),
  publications: await readJson<Publication[]>("data/publications.json"),
  baking: await readJson<Bake[]>("data/baking.json"),
  other: await readJson<OtherSection[]>("data/other.json"),
};
validateSiteData(data);

const { site, pages: pageCopy, projects, publications, baking, other } = data;
const preparedOther = await prepareOtherSections(source, other);
const stylesheetSources = [
  "tokens.css",
  "base.css",
  "pages.css",
  "components.css",
  "themes/blueprint.css",
  "themes/scifi.css",
  "style-options.css",
  "responsive.css",
];
const pages = [
  {
    route: "",
    id: "home",
    title: pageCopy.home.title,
    description: pageCopy.home.description || site.description,
    content: renderHome(await readContent("home.html")),
  },
  {
    route: "publications",
    id: "publications",
    title: pageCopy.publications.title,
    description: pageCopy.publications.description,
    content: renderPublications(publications),
  },
  {
    route: "projects",
    id: "projects",
    title: pageCopy.projects.title,
    description: pageCopy.projects.description,
    content: renderProjects(projects),
  },
  {
    route: "baking",
    id: "baking",
    title: pageCopy.baking.title,
    description: pageCopy.baking.description,
    content: renderBaking(baking),
  },
  {
    route: "other",
    id: "other",
    title: pageCopy.other.title,
    description: pageCopy.other.description,
    content: renderOther(preparedOther),
  },
];

const styleOptions = [
  {
    route: "style-options",
    id: "style-options",
    title: pageCopy.styleOptions.title,
    description: pageCopy.styleOptions.description,
    head: '<meta name="robots" content="noindex, nofollow">',
    content: await readContent("style-options/index.html"),
  },
  {
    route: "style-options/biotech-blueprint",
    id: "style-biotech-blueprint",
    title: pageCopy.styleBlueprint.title,
    description: pageCopy.styleBlueprint.description,
    head: '<meta name="robots" content="noindex, nofollow">',
    content: await readContent("style-options/biotech-blueprint.html"),
  },
];

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });

for (const page of [...pages, ...styleOptions]) {
  await writePage(page.route, layout(page));
}

for (const project of projects) {
  const body = await readContent(`projects/${project.slug}.html`);
  await writePage(
    `projects/${project.slug}`,
    layout({
      id: "projects",
      canonicalPath: `projects/${project.slug}/`,
      title: project.title,
      description: project.summary,
      content: renderDetail(project, body),
    }),
  );
}

for (const bake of baking) {
  await writePage(
    `bakes/${bake.slug}`,
    layout({
      id: "baking",
      canonicalPath: `bakes/${bake.slug}/`,
      title: bake.title,
      description: bake.description,
      content: renderBakeDetail(bake),
    }),
  );
}

await writePage(
  "cv",
  layout({
    id: "cv",
    title: pageCopy.cv.title,
    description: pageCopy.cv.description,
    head: `<meta http-equiv="refresh" content="0;url=${escapeHtml(site.cvUrl)}">`,
    content: `<section class="prose narrow"><p class="eyebrow">${escapeHtml(
      pageCopy.cv.eyebrow,
    )}</p><h1>${escapeHtml(pageCopy.cv.heading)}</h1><p>${escapeHtml(
      pageCopy.cv.fallbackText,
    )} <a href="${escapeHtml(site.cvUrl)}">${escapeHtml(pageCopy.cv.linkLabel)}</a>.</p></section>`,
  }),
);

await fs.writeFile(
  path.join(output, "404.html"),
  layout({
    id: "404",
    title: pageCopy.notFound.title,
    description: pageCopy.notFound.description,
    content: `<section class="prose narrow error-page"><p class="eyebrow">${escapeHtml(
      pageCopy.notFound.eyebrow,
    )}</p><h1>${escapeHtml(pageCopy.notFound.heading)}</h1><p>${escapeHtml(
      pageCopy.notFound.message,
    )}</p><a class="button" href="/">${escapeHtml(pageCopy.notFound.linkLabel)}</a></section>`,
  }),
);

await fs.cp(path.join(source, "assets"), path.join(output, "assets"), { recursive: true });
await generateResponsiveImages(source, output, preparedOther);
await promisify(execFile)(
  process.execPath,
  [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.client.json"],
  { cwd: root },
);
const stylesheet = await Promise.all(
  stylesheetSources.map((file) => fs.readFile(path.join(source, "styles", file), "utf8")),
);
const cssOutput = path.join(output, "assets", "css");
await fs.mkdir(cssOutput, { recursive: true });
await fs.writeFile(path.join(cssOutput, "site.css"), `${stylesheet.join("\n")}\n`);
await fs.copyFile(path.join(root, "CNAME"), path.join(output, "CNAME"));
await fs.writeFile(
  path.join(output, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}/sitemap.xml\n`,
);
await fs.writeFile(
  path.join(output, "sitemap.xml"),
  renderSitemap([
    ...pages.map((page) => page.route),
    ...projects.map((project) => `projects/${project.slug}`),
    ...baking.map((bake) => `bakes/${bake.slug}`),
  ]),
);

console.log(
  `Built ${pages.length + styleOptions.length + projects.length + baking.length + 2} pages in dist/.`,
);

/**
 * Writes a complete HTML document to the index file for a public route.
 *
 * @param {string} route - Root-relative route without leading or trailing slashes.
 * @param {string} html - Complete HTML document produced by {@link layout}.
 */
async function writePage(route: string, html: string): Promise<void> {
  const directory = resolveWithin(output, route);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
}

/**
 * Wraps trusted generated page content in the shared document shell, metadata, navigation, and footer.
 *
 * @param {Page} page - Fully assembled page definition with escaped or trusted authored content.
 * @returns {string} A complete HTML document.
 */
function layout(page: Page): string {
  const canonicalPath =
    page.canonicalPath ??
    (page.route !== undefined
      ? page.route
        ? `${page.route}/`
        : ""
      : page.id === "404"
        ? "404.html"
        : `${page.id}/`);
  const canonical = `${site.siteUrl}/${canonicalPath}`;
  const title = page.id === "home" ? site.name : `${page.title} | ${site.name}`;
  const nav = site.navigation
    .map((item) => {
      const active = item.id === page.id ? ` aria-current="page"` : "";
      const external = item.external ? ` target="_blank" rel="noopener noreferrer"` : "";
      const marker = item.external
        ? `<span class="sr-only"> (opens in a new tab)</span><span aria-hidden="true">↗</span>`
        : "";
      return `<a href="${escapeHtml(item.url)}"${active}${external}>${escapeHtml(item.label)}${marker}</a>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(page.description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${site.siteUrl}/assets/images/social-preview.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#f5eee3">
    <link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">
    <script>
      document.documentElement.classList.add("js");
      if (!location.pathname.startsWith("/style-options/")) {
        try {
          const theme = localStorage.getItem("site-theme");
          if (theme === "blueprint" || theme === "scifi") document.documentElement.dataset.siteTheme = theme;
        } catch {}
      }
    </script>
    <link rel="stylesheet" href="/assets/css/site.css">
${page.head ? `    ${page.head}\n` : ""}    ${analytics()}
    <script type="application/ld+json">${personSchema()}</script>
    <script src="/assets/js/site.js" defer></script>
  </head>
  <body data-page="${escapeHtml(page.id)}">
    <a class="skip-link" href="#main">Skip to main content</a>
    <button class="theme-reset" type="button" data-theme-reset hidden>
      <span aria-hidden="true">↺</span> Default theme
    </button>
    <header class="site-header">
      <a class="wordmark" href="/">
        <span>Michael</span> <span>Vanden Heuvel</span>
      </a>
      <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-navigation">
        <span>Menu</span><span class="menu-icon" aria-hidden="true"></span>
      </button>
      <nav id="site-navigation" class="site-nav" aria-label="Main navigation">${nav}</nav>
    </header>
    <main id="main">${page.content}</main>
    ${footer()}
  </body>
</html>`;
}

/**
 * Builds the shared footer from validated site identity and social-link data.
 *
 * @returns {string} Footer HTML.
 */
function footer(): string {
  const links = site.socials
    .map(
      (item) =>
        `<a href="${escapeHtml(item.url)}"${
          item.external ? ` target="_blank" rel="noopener noreferrer"` : ""
        }>${escapeHtml(item.label)}${
          item.external ? `<span class="sr-only"> (opens in a new tab)</span>` : ""
        }</a>`,
    )
    .join("");
  return `<footer class="site-footer"><div><p class="footer-name">${escapeHtml(site.name)}</p><p>${escapeHtml(
    site.footerLine,
  )}</p></div><nav aria-label="Social and contact links">${links}</nav><p class="copyright">© ${new Date().getFullYear()} ${escapeHtml(
    site.name,
  )}</p></footer>`;
}

/**
 * Builds the filterable project index from validated records and centralized page copy.
 *
 * @param {Project[]} entries - Projects in their intended display order.
 * @returns {string} Project intro, filters, and cards.
 */
function renderProjects(entries: Project[]): string {
  const filters = ["all", ...new Set(entries.map((entry) => entry.category))];
  return `<header class="page-intro"><p class="eyebrow">${escapeHtml(
    pageCopy.projects.eyebrow,
  )}</p><h1>${escapeHtml(pageCopy.projects.heading)}</h1>${renderOptionalIntroduction(
    pageCopy.projects.introduction,
  )}</header>
  <div class="filters" role="group" aria-label="Filter projects">${filters
    .map(
      (filter) =>
        `<button type="button" data-filter="${escapeHtml(filter)}" aria-pressed="${filter === "all"}">${
          filter === "all" ? "All" : titleCase(filter)
        }</button>`,
    )
    .join("")}</div>
  <section class="card-grid project-grid" aria-live="polite">${entries.map(projectCard).join("")}</section>`;
}

/**
 * Renders one project card, escaping every JSON-sourced value before insertion.
 *
 * @param {Project} project - Validated project metadata.
 * @returns {string} Project-card HTML.
 */
function projectCard(project: Project): string {
  return `<article class="card project-card" data-category="${escapeHtml(project.category)}">
    <a class="card-image" href="/projects/${escapeHtml(project.slug)}/"><img src="${escapeHtml(
      project.image,
    )}" alt="${escapeHtml(project.alt)}" width="${project.width}" height="${project.height}" loading="lazy"></a>
    <div class="card-body"><p class="card-kicker">${escapeHtml(
      project.category,
    )}</p><h2><a href="/projects/${escapeHtml(project.slug)}/">${escapeHtml(
      project.title,
    )}</a></h2><p>${escapeHtml(project.summary)}</p><ul class="tag-list">${project.tags
      .map((tag) => `<li>${escapeHtml(tag)}</li>`)
      .join("")}</ul></div>
  </article>`;
}

/**
 * Combines structured project metadata with its trusted long-form HTML fragment.
 *
 * @param {Project} project - Validated project metadata.
 * @param {string} body - Trusted HTML loaded from src/content/projects/.
 * @returns {string} Project-detail HTML.
 */
function renderDetail(project: Project, body: string): string {
  const links = (project.links ?? [])
    .map(
      (link) =>
        `<a class="text-link" href="${escapeHtml(
          link.url,
        )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          link.label,
        )} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`,
    )
    .join("");
  return `<article class="detail"><a class="back-link" href="/projects/">← ${escapeHtml(
    pageCopy.projects.backLabel,
  )}</a><header class="detail-header"><div><p class="eyebrow">${escapeHtml(
    pageCopy.projects.detailLabel,
  )} · ${escapeHtml(project.category)}</p><h1>${escapeHtml(project.title)}</h1><p class="lede">${escapeHtml(
    project.summary,
  )}</p><div class="detail-links">${links}</div></div><img src="${escapeHtml(
    project.image,
  )}" alt="${escapeHtml(
    project.alt,
  )}" width="${project.width}" height="${project.height}"></header><div class="prose">${body}</div></article>`;
}

/**
 * Builds the publications page from citation records and optional centralized introductory copy.
 *
 * @param {Publication[]} entries - Validated scholarly publication records.
 * @returns {string} Publications-page HTML.
 */
function renderPublications(entries: Publication[]): string {
  return `<header class="page-intro"><p class="eyebrow">${escapeHtml(
    pageCopy.publications.eyebrow,
  )}</p><h1>${escapeHtml(pageCopy.publications.heading)}</h1>${renderOptionalIntroduction(
    pageCopy.publications.introduction,
  )}</header><section class="publication-list">${entries
    .map(
      (item) =>
        `<article class="publication" itemscope itemtype="https://schema.org/ScholarlyArticle"><p class="publication-year">${
          item.year
        }</p><div><h2 itemprop="name">${escapeHtml(item.title)}</h2><p itemprop="author">${escapeHtml(
          item.authors,
        )}</p><p><em itemprop="isPartOf">${escapeHtml(item.venue)}</em> · ${escapeHtml(
          item.volume,
        )}</p><div class="publication-links"><a href="https://doi.org/${escapeHtml(
          item.doi,
        )}" target="_blank" rel="noopener noreferrer">DOI <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a><a href="${escapeHtml(
          item.pdf,
        )}">PDF</a><button class="citation-button" type="button" aria-live="polite" data-citation="${escapeHtml(
          item.citation,
        )}">Copy citation</button></div></div></article>`,
    )
    .join("")}</section>`;
}

/**
 * Builds the baking index from structured records and optional centralized introductory copy.
 *
 * @param {Bake[]} entries - Bakes in their intended display order.
 * @returns {string} Baking intro and card-grid HTML.
 */
function renderBaking(entries: Bake[]): string {
  return `<header class="page-intro playful"><p class="eyebrow">${escapeHtml(
    pageCopy.baking.eyebrow,
  )}</p><h1>${escapeHtml(pageCopy.baking.heading)}</h1>${renderOptionalIntroduction(
    pageCopy.baking.introduction,
  )}</header><section class="card-grid bake-grid">${entries
    .map(
      (item) =>
        `<article class="card bake-card"><a class="card-image" href="/bakes/${escapeHtml(
          item.slug,
        )}/"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(
          item.alt,
        )}" width="1200" height="900" loading="lazy"></a><div class="card-body"><h2><a href="/bakes/${escapeHtml(
          item.slug,
        )}/">${escapeHtml(item.title)}</a></h2><p>${escapeHtml(item.description)}</p></div></article>`,
    )
    .join("")}</section>`;
}

/**
 * Builds the Other page from reusable ordered image-collection sections.
 *
 * @param {PreparedOtherSection[]} sections - Collections with detected source dimensions.
 * @returns {string} Page introduction, galleries, and shared lightbox dialog.
 */
function renderOther(sections: PreparedOtherSection[]): string {
  return `<div class="other-page"><header class="page-intro"><p class="eyebrow">${escapeHtml(
    pageCopy.other.eyebrow,
  )}</p><h1>${escapeHtml(pageCopy.other.heading)}</h1>${renderOptionalIntroduction(
    pageCopy.other.introduction,
  )}</header>${sections
    .map(
      (section) =>
        `<section class="other-section" aria-labelledby="other-${escapeHtml(
          section.id,
        )}-title"><header class="other-section-header"><h2 id="other-${escapeHtml(
          section.id,
        )}-title">${escapeHtml(section.title)}</h2><p>${escapeHtml(
          section.description,
        )}</p></header><div class="other-gallery">${section.images
          .map(otherGalleryImage)
          .join("")}</div></section>`,
    )
    .join("")}</div>${renderLightbox()}`;
}

/**
 * Renders one progressively enhanced gallery image link.
 *
 * @param {PreparedOtherImage} image - Validated source image metadata and detected dimensions.
 * @returns {string} Responsive image link used by the shared lightbox.
 */
function otherGalleryImage(image: PreparedOtherImage): string {
  const widths = otherImageWidths(image.width);
  const largestWidth = widths.at(-1);
  assert(largestWidth, `${image.image} must have a responsive image width`);
  const largeImage = imageVariantPath(image.image, largestWidth);
  const srcset = widths
    .map((width) => `${escapeHtml(imageVariantPath(image.image, width))} ${width}w`)
    .join(", ");
  const caption = image.caption ? ` data-lightbox-caption="${escapeHtml(image.caption)}"` : "";

  return `<a class="other-gallery-item" href="${escapeHtml(
    largeImage,
  )}" data-lightbox-image data-lightbox-src="${escapeHtml(
    largeImage,
  )}" data-lightbox-alt="${escapeHtml(image.alt)}"${caption}><picture><source type="image/webp" srcset="${srcset}" sizes="(max-width: 560px) calc(100vw - 2 * var(--space-m)), (max-width: 800px) 50vw, 33vw"><img src="${escapeHtml(
    image.image,
  )}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${
    image.height
  }" loading="lazy"></picture><span class="sr-only">Open larger view</span></a>`;
}

/** Renders the single modal image viewer shared by every Other page gallery. */
function renderLightbox(): string {
  return `<dialog class="lightbox" aria-labelledby="lightbox-title"><div class="lightbox-panel"><h2 id="lightbox-title" class="sr-only">Image preview</h2><button class="lightbox-close" type="button" aria-label="Close image preview">×</button><figure><img class="lightbox-image" src="/assets/images/favicon.svg" alt="" hidden><figcaption class="lightbox-caption" hidden></figcaption></figure></div></dialog>`;
}

/**
 * Builds a bake detail page from one validated record.
 *
 * @param {Bake} item - Bake metadata and optional external recipe URL.
 * @returns {string} Bake-detail HTML.
 */
function renderBakeDetail(item: Bake): string {
  return `<article class="detail bake-detail"><a class="back-link" href="/baking/">← ${escapeHtml(
    pageCopy.baking.backLabel,
  )}</a><header class="detail-header"><div><p class="eyebrow">${escapeHtml(
    pageCopy.baking.detailEyebrow,
  )}</p><h1>${escapeHtml(item.title)}</h1><p class="lede">${escapeHtml(item.description)}</p>${
    item.recipeUrl
      ? `<a class="text-link" href="${escapeHtml(
          item.recipeUrl,
        )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          pageCopy.baking.recipeLabel,
        )} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`
      : ""
  }</div><img src="${escapeHtml(item.image)}" alt="${escapeHtml(
    item.alt,
  )}" width="1200" height="900"></header></article>`;
}

/**
 * Produces the production-only analytics bootstrap using the configured measurement ID.
 *
 * @returns {string} Inline analytics loader script.
 */
function analytics(): string {
  const analyticsId = escapeHtml(site.analyticsId);
  return `<script>
      const isLocalPreview = location.hostname === "localhost" ||
        location.hostname.endsWith(".localhost") ||
        location.hostname === "127.0.0.1" ||
        location.hostname === "::1";
      if (!isLocalPreview) {
        const analyticsScript = document.createElement("script");
        analyticsScript.async = true;
        analyticsScript.src = "https://www.googletagmanager.com/gtag/js?id=${analyticsId}";
        document.head.append(analyticsScript);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag("js", new Date());
        window.gtag("config", "${analyticsId}", { anonymize_ip: true });
      }
    </script>`;
}

/**
 * Serializes the public site identity as schema.org Person structured data.
 *
 * @returns {string} JSON safe for embedding in an HTML script element.
 */
function personSchema(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    url: site.siteUrl,
    image: `${site.siteUrl}/assets/images/profile.jpg`,
    jobTitle: site.currentRole,
    sameAs: site.socials.filter((item) => item.external).map((item) => item.url),
    knowsAbout: ["machine learning", "computational biology", "medical imaging", "protein engineering"],
  }).replaceAll("<", "\\u003c");
}

/**
 * Creates the sitemap from public routes only.
 *
 * @param {string[]} routes - Root-relative routes without leading slashes.
 * @returns {string} XML sitemap document.
 */
function renderSitemap(routes: string[]): string {
  const urls = routes
    .map((route) => `  <url><loc>${site.siteUrl}/${route ? `${route}/` : ""}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Converts a machine-readable category value into a filter-button label.
 *
 * @param {string} value - Lowercase category identifier.
 * @returns {string} Human-readable title-cased label.
 */
function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Inserts optional homepage copy at the documented marker in the trusted HTML fragment.
 *
 * @param {string} content - Homepage HTML containing the introduction marker.
 * @returns {string} Homepage HTML with the optional paragraph inserted or the marker removed.
 */
function renderHome(content: string): string {
  const marker = "<!-- Optional pages.json home introduction -->";
  const introduction = renderOptionalIntroduction(pageCopy.home.introduction, "hero-lede");
  return content.replace(`    ${marker}\n`, introduction ? `    ${introduction}\n` : "");
}

/**
 * Renders an optional escaped paragraph so empty strings in pages.json act as visible edit slots.
 *
 * @param {string | undefined} text - Optional authored copy from pages.json.
 * @param {string} [className] - Optional CSS class for the generated paragraph.
 * @returns {string} Paragraph HTML when populated; otherwise an empty string.
 */
function renderOptionalIntroduction(text: string | undefined, className?: string): string {
  if (!text) return "";
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
  return `<p${classAttribute}>${escapeHtml(text)}</p>`;
}
