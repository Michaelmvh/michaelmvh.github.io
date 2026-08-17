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
export interface Site {
  name: string;
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

/** Project card and detail-page metadata from projects.json. */
export interface Project {
  /** URL segment and matching content-fragment filename. */
  slug: string;
  title: string;
  /** Card copy and detail-page lead. */
  summary: string;
  /** Filter identifier displayed in title case. */
  category: string;
  /** Root-relative image path. */
  image: string;
  /** Intrinsic dimensions used to prevent layout shift. */
  width: number;
  height: number;
  alt: string;
  tags: string[];
  links: ExternalLink[];
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

/** Baking card and detail-page metadata from baking.json. */
export interface Bake {
  slug: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  recipeUrl: string;
}

/** Reusable page-level copy from pages.json. */
export interface PageCopy {
  title: string;
  /** SEO/social summary; homepage falls back to site.json when empty. */
  description: string;
}

export interface HomePageCopy extends PageCopy {
  /** Optional escaped paragraph; an empty string renders nothing. */
  introduction: string;
}

export interface IndexPageCopy extends PageCopy {
  eyebrow: string;
  heading: string;
  introduction: string;
}

export interface ProjectPageCopy extends IndexPageCopy {
  detailLabel: string;
  backLabel: string;
}

export interface BakingPageCopy extends IndexPageCopy {
  detailEyebrow: string;
  backLabel: string;
  recipeLabel: string;
}

export interface CvPageCopy extends PageCopy {
  eyebrow: string;
  heading: string;
  fallbackText: string;
  linkLabel: string;
}

export interface NotFoundPageCopy extends PageCopy {
  eyebrow: string;
  heading: string;
  message: string;
  linkLabel: string;
}

/** Human-readable documentation embedded in pages.json because JSON does not support comments. */
export interface PageInstructions {
  purpose: string;
  emptyStrings: string;
  fields: Record<string, string>;
}

/** All centralized page copy and its embedded editing instructions. */
export interface Pages {
  _instructions: PageInstructions;
  home: HomePageCopy;
  publications: IndexPageCopy;
  projects: ProjectPageCopy;
  baking: BakingPageCopy;
  cv: CvPageCopy;
  notFound: NotFoundPageCopy;
  styleOptions: PageCopy;
  styleBlueprint: PageCopy;
}

/** Complete validated content model consumed by the static generator. */
export interface SiteData {
  site: Site;
  pages: Pages;
  projects: Project[];
  publications: Publication[];
  baking: Bake[];
}

/** One fully assembled page passed to the shared document layout. */
export interface Page {
  /** Body identifier and active-navigation key. */
  id: string;
  title: string;
  description: string;
  /** Trusted assembled HTML placed inside main. */
  content: string;
  route?: string;
  canonicalPath?: string;
  /** Trusted page-specific head markup such as noindex metadata. */
  head?: string;
}
