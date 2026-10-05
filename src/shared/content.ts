import type { PageCopyMap } from "./page-copy.ts";

/** One shared destination in primary navigation or the footer. */
export interface LinkItem {
  /** Human-readable link text. */
  label: string;
  /** Root-relative or absolute destination. */
  url: string;
  /** Whether to add new-tab behavior and accessible context. */
  external?: boolean;
}

/** One link in primary navigation. */
export interface NavigationItem extends LinkItem {
  /** Stable identifier matched against the active page. */
  id: string;
}

/** Shared identity, navigation, analytics, and footer settings from site.json. */
export interface SiteConfig {
  name: string;
  wordmark: string[];
  knowsAbout: string[];
  siteUrl: string;
  description: string;
  currentRole: string;
  footerLine: string;
  analyticsId: string;
  cvUrl: string;
  navigation: NavigationItem[];
  socials: LinkItem[];
}

/** Public supporting link attached to a project record. */
export interface ExternalLink {
  label: string;
  url: string;
}

/** An image with intrinsic dimensions, either authored or detected during preparation. */
export interface ImageWithDimensions {
  /** Root-relative image path. */
  image: string;
  /** Intrinsic dimensions used to prevent layout shift. */
  width: number;
  height: number;
  alt: string;
}

export interface ProjectScreenshot extends ImageWithDimensions {
  id: string;
  caption: string;
}

/** Project card and detail-page metadata from projects.json. */
export interface Project extends ImageWithDimensions {
  /** URL segment and matching content-fragment filename. */
  slug: string;
  title: string;
  /** Card copy and detail-page lead. */
  summary: string;
  /** Filter identifier displayed in title case. */
  category: string;
  tags: string[];
  links: ExternalLink[];
  /** Ordered, captioned figures displayed after the project narrative. */
  screenshots?: ProjectScreenshot[];
}

/** Scholarly publication metadata used to render citations and links. */
export interface Publication {
  id: string;
  title: string;
  authors: string;
  venue: string;
  volume: string;
  year: number;
  doi: string;
  pdf: string;
  citation: string;
}

/** A dated homepage milestone from news.json. */
export interface NewsEntry {
  id: string;
  /** ISO date with year, month, or day precision: YYYY, YYYY-MM, or YYYY-MM-DD. */
  date: string;
  text: string;
}

/** Baking card and detail-page metadata from baking.json. */
export interface Bake {
  slug: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  recipeUrl: string;
}

/** One image in an Other page collection section. */
export interface OtherImage {
  /** Stable identifier unique within its section. */
  id: string;
  /** Root-relative path to the source image. */
  image: string;
  alt: string;
  /** Optional text displayed only while the lightbox is open. */
  caption?: string;
}

/** One reusable image collection on the Other page. */
export interface OtherSection {
  /** Stable section anchor and identifier. */
  id: string;
  title: string;
  description: string;
  images: OtherImage[];
}

export interface Tool {
  slug: string;
  name: string;
  description: string;
}

/** Complete validated content model consumed by the static generator. */
export interface SiteData {
  site: SiteConfig;
  pages: PageCopyMap;
  projects: Project[];
  publications: Publication[];
  news: NewsEntry[];
  baking: Bake[];
  other: OtherSection[];
  tools: Tool[];
}
