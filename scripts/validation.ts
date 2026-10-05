import { assert } from "./site.ts";
import type { SiteData } from "../src/shared/content.ts";
import type { PageCopyMap } from "../src/shared/page-copy.ts";
import type { DocumentEditorCopy } from "../src/shared/document-copy.ts";

/** Validates required fields and unique identifiers before any site files are generated. */
export function validateSiteData(value: unknown): asserts value is SiteData {
  const data = record(value, "site data");
  const site = record(data.site, "site.json");
  for (const key of ["name", "description", "currentRole", "footerLine"] as const) {
    requiredString(site, key, "site.json");
  }
  stringArray(site.wordmark, "site.json: wordmark", true);
  stringArray(site.knowsAbout, "site.json: knowsAbout", true);
  const siteUrl = requiredString(site, "siteUrl", "site.json");
  const parsedSiteUrl = absoluteUrl(siteUrl, 'site.json: "siteUrl"');
  assert(parsedSiteUrl.protocol === "https:", 'site.json: "siteUrl" must use HTTPS');
  assert(
    parsedSiteUrl.origin === siteUrl,
    'site.json: "siteUrl" must be an origin without a trailing slash or path',
  );

  const analyticsId = requiredString(site, "analyticsId", "site.json");
  assert(/^G-[A-Z0-9]+$/.test(analyticsId), 'site.json: "analyticsId" must be a Google measurement ID');
  rootRelativeUrl(requiredString(site, "cvUrl", "site.json"), 'site.json: "cvUrl"');

  const navigation = array(site.navigation, "site.json: navigation");
  assert(navigation.length > 0, "site.json: navigation is required");
  const navigationIds = new Set<string>();
  navigation.forEach((value, index) => {
    const item = record(value, `site.json: navigation[${index}]`);
    const id = safeIdentifier(
      requiredString(item, "id", `site.json: navigation[${index}]`),
      `site.json: navigation[${index}].id`,
    );
    assert(!navigationIds.has(id), `site.json: duplicate navigation id "${id}"`);
    navigationIds.add(id);
    requiredString(item, "label", `site.json: navigation[${index}]`);
    linkUrl(
      requiredString(item, "url", `site.json: navigation[${index}]`),
      `site.json: navigation[${index}].url`,
    );
    optionalBoolean(item, "external", `site.json: navigation[${index}]`);
  });

  const socials = array(site.socials, "site.json: socials");
  assert(socials.length > 0, "site.json: socials is required");
  socials.forEach((value, index) => {
    const item = record(value, `site.json: socials[${index}]`);
    requiredString(item, "label", `site.json: socials[${index}]`);
    absoluteUrl(
      requiredString(item, "url", `site.json: socials[${index}]`),
      `site.json: socials[${index}].url`,
    );
    optionalBoolean(item, "external", `site.json: socials[${index}]`);
  });

  const editorFields = {
    clearLabel: true,
    formatLabel: true,
    minifyLabel: true,
    copyLabel: true,
    downloadLabel: true,
    formattedHeading: true,
    diffHeading: true,
    addedLabel: true,
    removedLabel: true,
    unchangedLabel: true,
    noNewlineLabel: true,
    noScriptMessage: true,
    readyMessage: true,
    editedMessage: true,
    waitingMessage: true,
    loadErrorMessage: true,
    errorMessage: true,
    syntaxMessage: true,
    duplicateMessage: true,
    depthMessage: true,
    limitMessage: true,
    comparisonLimitMessage: true,
    formattedMessage: true,
    identicalMessage: true,
    summaryMessage: true,
    copiedMessage: true,
    copyErrorMessage: true,
  } satisfies Record<keyof DocumentEditorCopy, true>;
  const pageFields = {
    lightbox: {
      heading: true,
      openLabel: true,
      closeLabel: true,
      loadingMessage: true,
      errorMessage: true,
      retryLabel: true,
    },
    home: {
      title: true,
      description: false,
      introduction: false,
      newsHeading: true,
    },
    publications: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: false,
      doiLabel: true,
      pdfLabel: true,
      copyLabel: true,
      copiedMessage: true,
      copyErrorMessage: true,
    },
    projects: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: true,
      detailLabel: true,
      backLabel: true,
      screenshotsLabel: true,
      filterLabel: true,
      allLabel: true,
    },
    baking: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: false,
      detailEyebrow: true,
      backLabel: true,
      recipeLabel: true,
    },
    other: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: false,
    },
    cv: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      fallbackText: true,
      linkLabel: true,
    },
    notFound: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      message: true,
      linkLabel: true,
    },
    styleOptions: {
      title: true,
      description: true,
    },
    styleBlueprint: {
      title: true,
      description: true,
    },
    tools: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: true,
      backLabel: true,
      documentEditor: editorFields,
    },
    jsonFormatter: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: true,
      originalLabel: true,
      revisedLabel: true,
      inputHint: true,
      optionLabel: true,
    },
    textDiff: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: true,
      originalLabel: true,
      revisedLabel: true,
      inputHint: true,
      optionLabel: true,
    },
    urlInspector: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: true,
      inputLabel: true,
      outputLabel: true,
      inputHint: true,
      clearLabel: true,
      copyLabel: true,
      downloadLabel: true,
      noScriptMessage: true,
      readyMessage: true,
      updatedMessage: true,
      limitMessage: true,
      errorMessage: true,
      copiedMessage: true,
      copyErrorMessage: true,
      componentsHeading: true,
      schemeLabel: true,
      originLabel: true,
      hostnameLabel: true,
      portLabel: true,
      pathLabel: true,
      fragmentLabel: true,
      parametersHeading: true,
      parametersHint: true,
      parameterNameLabel: true,
      parameterValueLabel: true,
      parameterSelectLabel: true,
      trackingLabel: true,
      addLabel: true,
      selectTrackingLabel: true,
      removeSelectedLabel: true,
      invalidMessage: true,
      encodingMessage: true,
      credentialsMessage: true,
    },
    textUtilities: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: true,
      inputLabel: true,
      outputLabel: true,
      inputHint: true,
      clearLabel: true,
      copyLabel: true,
      downloadLabel: true,
      noScriptMessage: true,
      readyMessage: true,
      updatedMessage: true,
      limitMessage: true,
      errorMessage: true,
      copiedMessage: true,
      copyErrorMessage: true,
      caseLabel: true,
      unchangedLabel: true,
      lowerLabel: true,
      upperLabel: true,
      capitalizeLabel: true,
      trimLabel: true,
      removeBlankLabel: true,
      deduplicateLabel: true,
      sortLabel: true,
      originalOrderLabel: true,
      ascendingLabel: true,
      descendingLabel: true,
      countMessage: true,
      updatingMessage: true,
    },
    mermaid: {
      helpLabel: true,
      recoveryLabel: true,
      restoreLabel: true,
      forgetLabel: true,
      recoveryOffMessage: true,
      recoveryPendingMessage: true,
      recoverySavedMessage: true,
      recoveryErrorMessage: true,
      recoveryLimitMessage: true,
      recoveryRestoringMessage: true,
      recoveryRestoreErrorMessage: true,
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: true,
      instructions: true,
      privacyHint: true,
      compatibilityHint: true,
      editorLabel: true,
      fullscreenLabel: true,
      exitFullscreenLabel: true,
      attributionLabel: true,
      licenseLabel: true,
      noScriptMessage: true,
      loadingMessage: true,
      readyMessage: true,
      loadErrorMessage: true,
      editorErrorMessage: true,
      fullscreenErrorMessage: true,
    },
    qrCode: {
      title: true,
      description: true,
      eyebrow: true,
      heading: true,
      introduction: true,
      inputLabel: true,
      inputHint: true,
      placeholder: true,
      previewLabel: true,
      emptyPreview: true,
      pngLabel: true,
      svgLabel: true,
      clearLabel: true,
      downloadHint: true,
      loadingMessage: true,
      emptyMessage: true,
      readyMessage: true,
      tooLongMessage: true,
      errorMessage: true,
      loadErrorMessage: true,
      noScriptMessage: true,
    },
    shared: {
      skipLink: true,
      defaultThemeLabel: true,
      defaultThemeActive: true,
      returnToDefaultTheme: true,
      menuLabel: true,
      navigationLabel: true,
      socialNavigationLabel: true,
      externalLinkHint: true,
    },
  } satisfies {
    [P in Exclude<keyof PageCopyMap, "_instructions">]: CopyRules<PageCopyMap[P]>;
  };
  const pages = record(data.pages, "pages.json");
  const instructions = record(pages._instructions, "pages.json: _instructions");
  requiredString(instructions, "purpose", "pages.json: _instructions");
  requiredString(instructions, "emptyStrings", "pages.json: _instructions");
  const instructionFields = record(instructions.fields, "pages.json: _instructions.fields");
  assert(Object.keys(instructionFields).length > 0, "pages.json: _instructions.fields must not be empty");
  for (const [field, description] of Object.entries(instructionFields)) {
    assert(
      typeof description === "string" && description.trim(),
      `pages.json: _instructions.fields.${field} is required`,
    );
  }

  for (const [pageName, fields] of Object.entries(pageFields)) {
    validateCopy(pages[pageName], fields, `pages.json: "${pageName}"`);
  }

  const tools = array(data.tools, "tools.json");
  validateUniqueCollection(tools, "tools.json", "slug", (entry, index) => {
    const location = `tools.json[${index}]`;
    safeIdentifier(requiredString(entry, "slug", location), `${location}.slug`);
    requiredString(entry, "name", location);
    requiredString(entry, "description", location);
  });

  const projects = array(data.projects, "projects.json");
  validateUniqueCollection(projects, "projects.json", "slug", (entry, index) => {
    const location = `projects.json[${index}]`;
    safeIdentifier(requiredString(entry, "slug", location), `${location}.slug`);
    for (const field of ["title", "summary", "category", "alt"] as const)
      requiredString(entry, field, location);
    safeIdentifier(requiredString(entry, "category", location), `${location}.category`);
    rootRelativeUrl(requiredString(entry, "image", location), `${location}.image`);
    positiveInteger(entry.width, `${location}.width`);
    positiveInteger(entry.height, `${location}.height`);
    stringArray(entry.tags, `${location}.tags`, true);
    if (entry.screenshots !== undefined) {
      const screenshots = array(entry.screenshots, `${location}.screenshots`);
      validateUniqueCollection(screenshots, `${location}.screenshots`, "id", (image, imageIndex) => {
        const imageLocation = `${location}.screenshots[${imageIndex}]`;
        validateGalleryImage(image, imageLocation);
        requiredString(image, "caption", imageLocation);
        positiveInteger(image.width, `${imageLocation}.width`);
        positiveInteger(image.height, `${imageLocation}.height`);
      });
    }
    array(entry.links, `${location}.links`).forEach((value, linkIndex) => {
      const link = record(value, `${location}.links[${linkIndex}]`);
      requiredString(link, "label", `${location}.links[${linkIndex}]`);
      absoluteUrl(
        requiredString(link, "url", `${location}.links[${linkIndex}]`),
        `${location}.links[${linkIndex}].url`,
      );
    });
  });

  const publications = array(data.publications, "publications.json");
  validateUniqueCollection(publications, "publications.json", "id", (entry, index) => {
    const location = `publications.json[${index}]`;
    safeIdentifier(requiredString(entry, "id", location), `${location}.id`);
    for (const field of ["title", "authors", "venue", "volume", "citation"] as const)
      requiredString(entry, field, location);
    positiveInteger(entry.year, `${location}.year`);
    const doi = requiredString(entry, "doi", location);
    assert(/^10\.\d{4,9}\/\S+$/.test(doi), `${location}.doi must be a valid DOI`);
    rootRelativeUrl(requiredString(entry, "pdf", location), `${location}.pdf`);
  });

  const news = array(data.news, "news.json");
  validateUniqueCollection(news, "news.json", "id", (entry, index) => {
    const location = `news.json[${index}]`;
    safeIdentifier(requiredString(entry, "id", location), `${location}.id`);
    requiredString(entry, "text", location);
    const date = requiredString(entry, "date", location);
    assert(
      /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date) && Number(date.slice(0, 4)) > 0,
      `${location}.date must use YYYY, YYYY-MM, or YYYY-MM-DD`,
    );
    const fullDate = date.length === 4 ? `${date}-01-01` : date.length === 7 ? `${date}-01` : date;
    const parsed = new Date(`${fullDate}T12:00:00Z`);
    assert(
      Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === fullDate,
      `${location}.date must be a valid calendar date`,
    );
  });

  const baking = array(data.baking, "baking.json");
  validateUniqueCollection(baking, "baking.json", "slug", (entry, index) => {
    const location = `baking.json[${index}]`;
    safeIdentifier(requiredString(entry, "slug", location), `${location}.slug`);
    for (const field of ["title", "description", "alt"] as const) requiredString(entry, field, location);
    rootRelativeUrl(requiredString(entry, "image", location), `${location}.image`);
    const recipeUrl = string(entry.recipeUrl, `${location}.recipeUrl`);
    if (recipeUrl) absoluteUrl(recipeUrl, `${location}.recipeUrl`);
  });

  const other = array(data.other, "other.json");
  validateUniqueCollection(other, "other.json", "id", (entry, index) => {
    const location = `other.json[${index}]`;
    safeIdentifier(requiredString(entry, "id", location), `${location}.id`);
    for (const field of ["title", "description"] as const) requiredString(entry, field, location);

    const images = array(entry.images, `${location}.images`);
    assert(images.length > 0, `${location}.images must not be empty`);
    validateUniqueCollection(images, `${location}.images`, "id", (image, imageIndex) => {
      const imageLocation = `${location}.images[${imageIndex}]`;
      validateGalleryImage(image, imageLocation);
    });
  });
}

function validateGalleryImage(image: Record<string, unknown>, location: string): void {
  safeIdentifier(requiredString(image, "id", location), `${location}.id`);
  rootRelativeUrl(requiredString(image, "image", location), `${location}.image`);
  requiredString(image, "alt", location);
  if (image.caption !== undefined) requiredString(image, "caption", location);
}

function validateUniqueCollection(
  values: unknown[],
  file: string,
  identifier: "id" | "slug",
  validate: (entry: Record<string, unknown>, index: number) => void,
): void {
  const ids = new Set<string>();
  values.forEach((value, index) => {
    const entry = record(value, `${file}[${index}]`);
    validate(entry, index);
    const id = requiredString(entry, identifier, `${file}[${index}]`);
    assert(!ids.has(id), `${file}: duplicate id "${id}"`);
    ids.add(id);
  });
}

function record(value: unknown, location: string): Record<string, unknown> {
  assert(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `${location} must be an object`,
  );
  return value as Record<string, unknown>;
}

function array(value: unknown, location: string): unknown[] {
  assert(Array.isArray(value), `${location} must be an array`);
  return value;
}

function string(value: unknown, location: string): string {
  assert(typeof value === "string", `${location} must be a string`);
  return value;
}

function requiredString(value: Record<string, unknown>, key: string, location: string): string {
  const result = string(value[key], `${location}: "${key}"`);
  assert(result.trim(), `${location}: "${key}" is required`);
  return result;
}

function stringArray(value: unknown, location: string, requireEntries = false): string[] {
  const values = array(value, location);
  if (requireEntries) assert(values.length > 0, `${location} must not be empty`);
  return values.map((entry, index) => {
    const result = string(entry, `${location}[${index}]`);
    assert(result.trim(), `${location}[${index}] is required`);
    return result;
  });
}

function positiveInteger(value: unknown, location: string): number {
  assert(
    typeof value === "number" && Number.isInteger(value) && value > 0,
    `${location} must be a positive integer`,
  );
  return value;
}

function optionalBoolean(value: Record<string, unknown>, key: string, location: string): void {
  assert(
    value[key] === undefined || typeof value[key] === "boolean",
    `${location}: "${key}" must be a boolean`,
  );
}

function safeIdentifier(value: string, location: string): string {
  assert(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    `${location} must use lowercase letters, numbers, and hyphens`,
  );
  return value;
}

function linkUrl(value: string, location: string): void {
  if (value.startsWith("/")) rootRelativeUrl(value, location);
  else absoluteUrl(value, location);
}

function rootRelativeUrl(value: string, location: string): void {
  assert(
    value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"),
    `${location} must be root-relative`,
  );
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new Error(`${location} contains invalid URL encoding`);
  }
  assert(!decoded.split("/").includes(".."), `${location} must not contain parent-directory segments`);
}

function absoluteUrl(value: string, location: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${location} must be an absolute URL`);
  }
  assert(parsed.protocol === "https:" || parsed.protocol === "http:", `${location} must use HTTP or HTTPS`);
  return parsed;
}

type CopyRules<T> = {
  [K in keyof T]-?: T[K] extends string ? boolean : CopyRules<T[K]>;
};

interface CopyFieldMap {
  [field: string]: boolean | CopyFieldMap;
}

function validateCopy(value: unknown, fields: CopyFieldMap, location: string): void {
  const copy = record(value, location);
  for (const [field, rule] of Object.entries(fields)) {
    if (typeof rule === "object") validateCopy(copy[field], rule, `${location}.${field}`);
    else if (rule) requiredString(copy, field, location);
    else string(copy[field], `${location}.${field}`);
  }
}
