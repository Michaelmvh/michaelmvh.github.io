import { loadSiteData } from "./data.ts";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import { createLayout, renderSitemap } from "./rendering/layout.ts";
import { createPortfolioRenderer } from "./rendering/portfolio.ts";
import { renderQrCode, renderTools } from "./tools.ts";
import { renderDocumentTool } from "./document-tools.ts";
import { renderUrlInspector, renderTextUtilities } from "./utility-tools.ts";
import { buildMermaidEditor, renderMermaid } from "./mermaid.ts";
import {
  generateResponsiveImages,
  generateTouchIcons,
  prepareImages,
  prepareOtherSections,
} from "./images.ts";
import { assert, escapeHtml, output, readContent, resolveWithin, root, source } from "./site.ts";
import type { RenderedPage } from "./rendering/types.ts";

const data = await loadSiteData();

const { site, pages: pageCopy, projects, publications, baking, other, tools } = data;
const layout = createLayout(site, pageCopy.shared);
const {
  renderHome,
  renderProjects,
  renderDetail,
  renderPublications,
  renderBaking,
  renderBakeDetail,
  renderOther,
  renderCv,
  renderNotFound,
} = createPortfolioRenderer(pageCopy, data.news);
const preparedOther = await prepareOtherSections(source, other);
const preparedBaking = await prepareImages(source, baking);
const stylesheetSources = [
  "tokens.css",
  "base.css",
  "pages.css",
  "components.css",
  "tools.css",
  "document-tools.css",
  "utility-tools.css",
  "mermaid-tool.css",
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
    content: renderBaking(preparedBaking),
  },
  {
    route: "other",
    id: "other",
    title: pageCopy.other.title,
    description: pageCopy.other.description,
    content: renderOther(preparedOther),
  },
];

const toolDefinitions: Record<string, Pick<RenderedPage, "title" | "description" | "head" | "content">> = {
  "url-inspector": {
    title: pageCopy.urlInspector.title,
    description: pageCopy.urlInspector.description,
    head: '<script type="module" src="/assets/js/url-inspector.js"></script>',
    content: renderUrlInspector(pageCopy.urlInspector, pageCopy.tools.backLabel),
  },
  "text-utilities": {
    title: pageCopy.textUtilities.title,
    description: pageCopy.textUtilities.description,
    head: '<script type="module" src="/assets/js/text-utilities.js"></script>',
    content: renderTextUtilities(pageCopy.textUtilities, pageCopy.tools.backLabel),
  },
  mermaid: {
    title: pageCopy.mermaid.title,
    description: pageCopy.mermaid.description,
    head: '<script type="module" src="/assets/js/mermaid-tool.js"></script>',
    content: renderMermaid(pageCopy.mermaid, pageCopy.tools.backLabel),
  },
  json: {
    title: pageCopy.jsonFormatter.title,
    description: pageCopy.jsonFormatter.description,
    head: '<script type="module" src="/assets/js/document-tools.js"></script>',
    content: renderDocumentTool(pageCopy.jsonFormatter, pageCopy.tools, "json"),
  },
  "text-diff": {
    title: pageCopy.textDiff.title,
    description: pageCopy.textDiff.description,
    head: '<script type="module" src="/assets/js/document-tools.js"></script>',
    content: renderDocumentTool(pageCopy.textDiff, pageCopy.tools, "text"),
  },
  "qr-code": {
    title: pageCopy.qrCode.title,
    description: pageCopy.qrCode.description,
    head: `<script type="importmap">{"imports":{"qrcode-generator":"/assets/js/vendor/qrcode.mjs"}}</script>
    <script type="module" src="/assets/js/qr-code.js"></script>`,
    content: renderQrCode(pageCopy.qrCode, pageCopy.tools.backLabel),
  },
};
const toolPages = tools.map((tool) => {
  const definition = Object.hasOwn(toolDefinitions, tool.slug) ? toolDefinitions[tool.slug] : undefined;
  assert(definition, `No page implementation for tools.json slug "${tool.slug}"`);
  return {
    ...definition,
    route: `tools/${tool.slug}`,
    id: `tool-${tool.slug}`,
    head: `<meta name="robots" content="noindex, nofollow">${definition.head ? `\n    ${definition.head}` : ""}`,
    analytics: false,
  };
});

const unlistedPages = [
  {
    route: "tools",
    id: "tools",
    title: pageCopy.tools.title,
    description: pageCopy.tools.description,
    head: '<meta name="robots" content="noindex, nofollow">',
    analytics: false,
    content: renderTools(pageCopy.tools, tools),
  },
  ...toolPages,
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

for (const page of [...pages, ...unlistedPages]) {
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

for (const bake of preparedBaking) {
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
    content: renderCv(site.cvUrl),
  }),
);

await fs.writeFile(
  path.join(output, "404.html"),
  layout({
    id: "404",
    title: pageCopy.notFound.title,
    description: pageCopy.notFound.description,
    content: renderNotFound(),
  }),
);

await fs.cp(path.join(source, "assets"), path.join(output, "assets"), { recursive: true });
await generateTouchIcons(source, output);
await buildMermaidEditor(pageCopy.mermaid);
await generateResponsiveImages(source, output, preparedOther, projects);
await promisify(execFile)(
  process.execPath,
  [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.client.json"],
  { cwd: root },
);
await fs.rename(path.join(output, "assets", "client"), path.join(output, "assets", "js"));
await bundle({
  entryPoints: [path.join(source, "client", "document-tools.ts")],
  outdir: path.join(output, "assets", "js"),
  chunkNames: "chunks/[name]-[hash]",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2023",
  minify: true,
  legalComments: "linked",
});
const stylesheet = await Promise.all(
  stylesheetSources.map((file) => fs.readFile(path.join(source, "styles", file), "utf8")),
);
const vendorOutput = path.join(output, "assets", "js", "vendor");
await fs.mkdir(vendorOutput, { recursive: true });
await fs.copyFile(
  path.join(root, "node_modules", "qrcode-generator", "dist", "qrcode.mjs"),
  path.join(vendorOutput, "qrcode.mjs"),
);
for (const [packageName, license] of [
  ["diff", "LICENSE"],
  ["jsonc-parser", "LICENSE.md"],
] as const) {
  await fs.copyFile(
    path.join(root, "node_modules", packageName, license),
    path.join(vendorOutput, `${packageName}-LICENSE.txt`),
  );
}
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
  renderSitemap(
    [
      ...pages.map((page) => page.route),
      ...projects.map((project) => `projects/${project.slug}`),
      ...baking.map((bake) => `bakes/${bake.slug}`),
    ],
    site.siteUrl,
  ),
);

console.log(
  `Built ${pages.length + unlistedPages.length + projects.length + baking.length + 2} pages in dist/.`,
);

async function writePage(route: string, html: string): Promise<void> {
  const directory = resolveWithin(output, route);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
}
