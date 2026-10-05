import { escapeHtml } from "../site.ts";
import type { SiteConfig } from "../../src/shared/content.ts";
import type { SharedCopy } from "../../src/shared/page-copy.ts";
import type { RenderedPage } from "./types.ts";

export function createLayout(site: SiteConfig, copy: SharedCopy, year = new Date().getFullYear()) {
  return layout;

  function layout(page: RenderedPage): string {
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
          ? `<span class="sr-only"> ${escapeHtml(copy.externalLinkHint)}</span><span aria-hidden="true">↗</span>`
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
    <link rel="apple-touch-icon" sizes="180x180" href="${page.id === "tools" || page.id.startsWith("tool-") ? "/tools/apple-touch-icon.png" : "/apple-touch-icon.png"}">
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
${page.head ? `    ${page.head}\n` : ""}${page.analytics === false ? "" : `    ${analytics()}`}
    <script type="application/ld+json">${personSchema()}</script>
    <script src="/assets/js/site.js" defer></script>
  </head>
  <body data-page="${escapeHtml(page.id)}">
    <a class="skip-link" href="#main">${escapeHtml(copy.skipLink)}</a>
    <button class="theme-reset" type="button" data-default-message="${escapeHtml(copy.defaultThemeActive)}" data-return-message="${escapeHtml(copy.returnToDefaultTheme)}" data-theme-reset hidden>
      <span aria-hidden="true">↺</span> ${escapeHtml(copy.defaultThemeLabel)}
    </button>
    <header class="site-header">
      <a class="wordmark" href="/">
        ${site.wordmark.map((part) => `<span>${escapeHtml(part)}</span>`).join(" ")}
      </a>
      <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-navigation">
        <span>${escapeHtml(copy.menuLabel)}</span><span class="menu-icon" aria-hidden="true"></span>
      </button>
      <nav id="site-navigation" class="site-nav" aria-label="${escapeHtml(copy.navigationLabel)}">${nav}</nav>
    </header>
    <main id="main">${page.content}</main>
    ${footer()}
  </body>
</html>`;
  }

  function footer(): string {
    const links = site.socials
      .map(
        (item) =>
          `<a href="${escapeHtml(item.url)}"${
            item.external ? ` target="_blank" rel="noopener noreferrer"` : ""
          }>${escapeHtml(item.label)}${
            item.external ? `<span class="sr-only"> ${escapeHtml(copy.externalLinkHint)}</span>` : ""
          }</a>`,
      )
      .join("");
    return `<footer class="site-footer"><div><p class="footer-name">${escapeHtml(site.name)}</p><p>${escapeHtml(
      site.footerLine,
    )}</p></div><nav aria-label="${escapeHtml(copy.socialNavigationLabel)}">${links}</nav><p class="copyright">© ${year} ${escapeHtml(
      site.name,
    )}</p></footer>`;
  }

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

  function personSchema(): string {
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: site.name,
      url: site.siteUrl,
      image: `${site.siteUrl}/assets/images/profile.jpg`,
      jobTitle: site.currentRole,
      sameAs: site.socials.filter((item) => item.external).map((item) => item.url),
      knowsAbout: site.knowsAbout,
    }).replaceAll("<", "\\u003c");
  }
}

export function renderSitemap(routes: string[], siteUrl: string): string {
  const urls = routes
    .map((route) => `  <url><loc>${siteUrl}/${route ? `${route}/` : ""}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
