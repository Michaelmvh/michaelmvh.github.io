import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pages, SiteData } from "./types.ts";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const source = path.join(root, "src");
export const output = path.join(root, "dist");

/** Reads and parses a trusted JSON source file beneath src/. */
export async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(resolveWithin(source, relativePath), "utf8")) as T;
}

/** Reads an authored, trusted HTML fragment from src/content/. */
export async function readContent(relativePath: string): Promise<string> {
  return fs.readFile(resolveWithin(path.join(source, "content"), relativePath), "utf8");
}

/** Resolves a path while preventing untrusted segments from escaping their expected root. */
export function resolveWithin(base: string, ...segments: string[]): string {
  const target = path.resolve(base, ...segments);
  assert(
    target === base || target.startsWith(`${base}${path.sep}`),
    `Path escapes ${base}: ${segments.join("/")}`,
  );
  return target;
}

/** Escapes structured-data values before inserting them into generated HTML. */
export function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Narrows validated data and throws a precise content error when an invariant fails. */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Validates required fields and unique identifiers before any site files are generated. */
export function validateSiteData(data: SiteData): void {
  const site = record(data.site, "site.json");
  for (const key of ["name", "description", "currentRole", "footerLine"] as const) {
    requiredString(site, key, "site.json");
  }
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

  type PageName = Exclude<keyof Pages, "_instructions">;
  const pageFields = {
    home: ["title", "description", "introduction"],
    publications: ["title", "description", "eyebrow", "heading", "introduction"],
    projects: ["title", "description", "eyebrow", "heading", "introduction", "detailLabel", "backLabel"],
    baking: [
      "title",
      "description",
      "eyebrow",
      "heading",
      "introduction",
      "detailEyebrow",
      "backLabel",
      "recipeLabel",
    ],
    cv: ["title", "description", "eyebrow", "heading", "fallbackText", "linkLabel"],
    notFound: ["title", "description", "eyebrow", "heading", "message", "linkLabel"],
    styleOptions: ["title", "description"],
    styleBlueprint: ["title", "description"],
  } satisfies Record<PageName, readonly string[]>;
  const optionalPageFields = new Set([
    "home.description",
    "home.introduction",
    "publications.introduction",
    "baking.introduction",
  ]);
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

  for (const pageName of Object.keys(pageFields) as PageName[]) {
    const page = record(pages[pageName], `pages.json: "${pageName}"`);
    for (const field of pageFields[pageName]) {
      const location = `pages.json: "${pageName}.${field}"`;
      if (optionalPageFields.has(`${pageName}.${field}`)) string(page[field], location);
      else requiredString(page, field, `pages.json: "${pageName}"`);
    }
  }

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

  const baking = array(data.baking, "baking.json");
  validateUniqueCollection(baking, "baking.json", "slug", (entry, index) => {
    const location = `baking.json[${index}]`;
    safeIdentifier(requiredString(entry, "slug", location), `${location}.slug`);
    for (const field of ["title", "description", "alt"] as const) requiredString(entry, field, location);
    rootRelativeUrl(requiredString(entry, "image", location), `${location}.image`);
    const recipeUrl = string(entry.recipeUrl, `${location}.recipeUrl`);
    if (recipeUrl) absoluteUrl(recipeUrl, `${location}.recipeUrl`);
  });
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
