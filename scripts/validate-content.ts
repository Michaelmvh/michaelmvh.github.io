import { readJson, validateSiteData } from "./site.ts";
import type { Bake, OtherSection, Pages, Project, Publication, Site, SiteData } from "./types.ts";

const data: SiteData = {
  site: await readJson<Site>("data/site.json"),
  pages: await readJson<Pages>("data/pages.json"),
  projects: await readJson<Project[]>("data/projects.json"),
  publications: await readJson<Publication[]>("data/publications.json"),
  baking: await readJson<Bake[]>("data/baking.json"),
  other: await readJson<OtherSection[]>("data/other.json"),
};

validateSiteData(data);
console.log("Content validation passed.");
