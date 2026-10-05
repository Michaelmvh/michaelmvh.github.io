import { assert, escapeHtml } from "../site.ts";
import { imageVariantPath, galleryImageWidths } from "../images.ts";
import type { PreparedOtherImage, PreparedOtherSection } from "../images.ts";
import type { Bake, ImageWithDimensions, Project, Publication, NewsEntry } from "../../src/shared/content.ts";
import type { PageCopyMap } from "../../src/shared/page-copy.ts";
import { renderNews } from "../news.ts";

export function createPortfolioRenderer(pageCopy: PageCopyMap, news: readonly NewsEntry[]) {
  return {
    renderHome,
    renderProjects,
    renderDetail,
    renderPublications,
    renderBaking,
    renderBakeDetail,
    renderOther,
    renderCv,
    renderNotFound,
  };

  function renderCv(cvUrl: string): string {
    const copy = pageCopy.cv;
    return `<section class="prose narrow"><p class="eyebrow">${escapeHtml(copy.eyebrow)}</p><h1>${escapeHtml(copy.heading)}</h1><p>${escapeHtml(copy.fallbackText)} <a href="${escapeHtml(cvUrl)}">${escapeHtml(copy.linkLabel)}</a>.</p></section>`;
  }

  function renderNotFound(): string {
    const copy = pageCopy.notFound;
    return `<section class="prose narrow error-page"><p class="eyebrow">${escapeHtml(copy.eyebrow)}</p><h1>${escapeHtml(copy.heading)}</h1><p>${escapeHtml(copy.message)}</p><a class="button" href="/">${escapeHtml(copy.linkLabel)}</a></section>`;
  }

  function renderProjects(entries: Project[]): string {
    const filters = ["all", ...new Set(entries.map((entry) => entry.category))];
    return `<header class="page-intro"><p class="eyebrow">${escapeHtml(
      pageCopy.projects.eyebrow,
    )}</p><h1>${escapeHtml(pageCopy.projects.heading)}</h1>${renderOptionalIntroduction(
      pageCopy.projects.introduction,
    )}</header>
  <div class="filters" role="group" aria-label="${escapeHtml(pageCopy.projects.filterLabel)}">${filters
    .map(
      (filter) =>
        `<button type="button" data-filter="${escapeHtml(filter)}" aria-pressed="${filter === "all"}">${
          filter === "all" ? escapeHtml(pageCopy.projects.allLabel) : titleCase(filter)
        }</button>`,
    )
    .join("")}</div>
  <section class="card-grid project-grid" aria-live="polite">${entries.map(projectCard).join("")}</section>`;
  }

  function projectCard(project: Project): string {
    return `<article class="card project-card" data-category="${escapeHtml(project.category)}">
    <a class="card-image" href="/projects/${escapeHtml(project.slug)}/">${renderImage(
      project,
      Boolean(project.screenshots?.length),
      "(max-width: 800px) 100vw, 33vw",
      "lazy",
    )}</a>
    <div class="card-body"><p class="card-kicker">${escapeHtml(
      project.category,
    )}</p><h2><a href="/projects/${escapeHtml(project.slug)}/">${escapeHtml(
      project.title,
    )}</a></h2><p>${escapeHtml(project.summary)}</p><ul class="tag-list">${project.tags
      .map((tag) => `<li>${escapeHtml(tag)}</li>`)
      .join("")}</ul></div>
  </article>`;
  }

  function renderDetail(project: Project, body: string): string {
    const screenshots = project.screenshots ?? [];
    const hero = screenshots.length
      ? galleryImageLink(project, "project-image-link", "(max-width: 800px) 100vw, 45vw", "eager", true)
      : renderImage(project, false, "100vw", "eager");
    const gallery = screenshots.length
      ? `<section class="project-screenshots" aria-labelledby="screenshots-heading"><h2 id="screenshots-heading">${escapeHtml(
          pageCopy.projects.screenshotsLabel,
        )}</h2>${screenshots
          .map(
            (image) =>
              `<figure id="screenshot-${escapeHtml(image.id)}" class="project-screenshot${image.height > image.width ? " project-screenshot-portrait" : ""}">${galleryImageLink(
                image,
                "project-image-link",
                "(max-width: 800px) 100vw, 70vw",
                "lazy",
                true,
              )}<figcaption>${escapeHtml(image.caption)}</figcaption></figure>`,
          )
          .join("")}</section>${renderLightbox()}`
      : "";
    const links = (project.links ?? [])
      .map(
        (link) =>
          `<a class="text-link" href="${escapeHtml(
            link.url,
          )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            link.label,
          )} <span aria-hidden="true">↗</span><span class="sr-only"> ${escapeHtml(pageCopy.shared.externalLinkHint)}</span></a>`,
      )
      .join("");
    return `<article class="detail"><a class="back-link" href="/projects/">← ${escapeHtml(
      pageCopy.projects.backLabel,
    )}</a><header class="detail-header"><div><p class="eyebrow">${escapeHtml(
      pageCopy.projects.detailLabel,
    )} · ${escapeHtml(project.category)}</p><h1>${escapeHtml(project.title)}</h1><p class="lede">${escapeHtml(
      project.summary,
    )}</p><div class="detail-links">${links}</div></div>${hero}</header><div class="prose">${body}</div>${gallery}</article>`;
  }

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
          )}" target="_blank" rel="noopener noreferrer">${escapeHtml(pageCopy.publications.doiLabel)} <span aria-hidden="true">↗</span><span class="sr-only"> ${escapeHtml(pageCopy.shared.externalLinkHint)}</span></a><a href="${escapeHtml(
            item.pdf,
          )}">${escapeHtml(pageCopy.publications.pdfLabel)}</a><button class="citation-button" type="button" aria-live="polite" data-copied-message="${escapeHtml(pageCopy.publications.copiedMessage)}" data-error-message="${escapeHtml(pageCopy.publications.copyErrorMessage)}" data-citation="${escapeHtml(
            item.citation,
          )}">${escapeHtml(pageCopy.publications.copyLabel)}</button></div></div></article>`,
      )
      .join("")}</section>`;
  }

  function renderBaking(entries: Array<Bake & ImageWithDimensions>): string {
    return `<header class="page-intro playful"><p class="eyebrow">${escapeHtml(
      pageCopy.baking.eyebrow,
    )}</p><h1>${escapeHtml(pageCopy.baking.heading)}</h1>${renderOptionalIntroduction(
      pageCopy.baking.introduction,
    )}</header><section class="card-grid bake-grid">${entries
      .map(
        (item) =>
          `<article class="card bake-card"><a class="card-image" href="/bakes/${escapeHtml(
            item.slug,
          )}/">${renderImage(item, false, "100vw", "lazy")}</a><div class="card-body"><h2><a href="/bakes/${escapeHtml(
            item.slug,
          )}/">${escapeHtml(item.title)}</a></h2><p>${escapeHtml(item.description)}</p></div></article>`,
      )
      .join("")}</section>`;
  }

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

  function otherGalleryImage(image: PreparedOtherImage): string {
    return galleryImageLink(
      image,
      "other-gallery-item",
      "(max-width: 560px) calc(100vw - 2 * var(--space-m)), (max-width: 800px) 50vw, 33vw",
    );
  }

  function renderImage(
    image: ImageWithDimensions,
    responsive: boolean,
    sizes: string,
    loading: "lazy" | "eager",
  ): string {
    const img = `<img src="${escapeHtml(image.image)}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" loading="${loading}">`;
    if (!responsive) return img;
    const srcset = galleryImageWidths(image.width)
      .map((width) => `${escapeHtml(imageVariantPath(image.image, width))} ${width}w`)
      .join(", ");
    return `<picture><source type="image/webp" srcset="${srcset}" sizes="${escapeHtml(sizes)}">${img}</picture>`;
  }

  function galleryImageLink(
    image: ImageWithDimensions & { caption?: string },
    className: string,
    sizes: string,
    loading: "lazy" | "eager" = "lazy",
    fullResolution = false,
  ): string {
    const widths = galleryImageWidths(image.width);
    const largestWidth = widths.at(-1);
    assert(largestWidth, `${image.image} must have a responsive image width`);
    const largeImage = fullResolution ? image.image : imageVariantPath(image.image, largestWidth);
    const caption = image.caption ? ` data-lightbox-caption="${escapeHtml(image.caption)}"` : "";

    return `<a class="${className}" href="${escapeHtml(
      largeImage,
    )}" data-lightbox-image data-lightbox-src="${escapeHtml(
      largeImage,
    )}" data-lightbox-alt="${escapeHtml(image.alt)}"${caption}>${renderImage(image, true, sizes, loading)}<span class="sr-only">${escapeHtml(pageCopy.lightbox.openLabel)}</span></a>`;
  }

  function renderLightbox(): string {
    const copy = pageCopy.lightbox;
    return `<dialog class="lightbox" aria-labelledby="lightbox-title" data-loading-message="${escapeHtml(copy.loadingMessage)}" data-error-message="${escapeHtml(copy.errorMessage)}"><section class="lightbox-panel" aria-labelledby="lightbox-title" tabindex="0"><h2 id="lightbox-title" class="sr-only">${escapeHtml(copy.heading)}</h2><button class="lightbox-close" type="button" aria-label="${escapeHtml(copy.closeLabel)}" autofocus>×</button><figure><div class="lightbox-media"><div class="lightbox-feedback"><p class="lightbox-status" role="status"></p><button class="lightbox-retry" type="button" hidden>${escapeHtml(copy.retryLabel)}</button></div></div><figcaption class="lightbox-caption" hidden></figcaption></figure></section></dialog>`;
  }

  function renderBakeDetail(item: Bake & ImageWithDimensions): string {
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
          )} <span aria-hidden="true">↗</span><span class="sr-only"> ${escapeHtml(pageCopy.shared.externalLinkHint)}</span></a>`
        : ""
    }</div>${renderImage(item, false, "100vw", "eager")}</header></article>`;
  }

  function titleCase(value: string): string {
    return value.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function renderHome(content: string): string {
    const marker = "<!-- Optional pages.json home introduction -->";
    const introduction = renderOptionalIntroduction(pageCopy.home.introduction, "hero-lede");
    const newsMarker = "<!-- Recent news from news.json -->";
    assert(content.includes(marker), "home.html: introduction marker is required");
    assert(content.includes(newsMarker), "home.html: recent news marker is required");
    return content
      .replace(
        /(^[ \t]*)?<!-- Optional pages\.json home introduction -->(\r?\n)?/m,
        (_match, indent: string = "", newline: string = "") =>
          introduction ? `${indent}${introduction}${newline}` : "",
      )
      .replace(newsMarker, () => renderNews(news, pageCopy.home.newsHeading));
  }

  function renderOptionalIntroduction(text: string | undefined, className?: string): string {
    if (!text) return "";
    const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
    return `<p${classAttribute}>${escapeHtml(text)}</p>`;
  }
}
