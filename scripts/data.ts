import type { SiteData } from "../src/shared/content.ts";
import { readJson } from "./site.ts";
import { validateSiteData } from "./validation.ts";

export async function loadSiteData(): Promise<SiteData> {
  const data = {
    site: await readJson("data/site.json"),
    pages: await readJson("data/pages.json"),
    projects: await readJson("data/projects.json"),
    publications: await readJson("data/publications.json"),
    news: await readJson("data/news.json"),
    baking: await readJson("data/baking.json"),
    other: await readJson("data/other.json"),
    tools: await readJson("data/tools.json"),
  } satisfies Record<keyof SiteData, unknown>;
  validateSiteData(data);
  return data;
}
