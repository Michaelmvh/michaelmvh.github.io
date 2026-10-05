/** One fully assembled page passed to the shared document layout. */
export interface RenderedPage {
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
  /** Whether production analytics are allowed; defaults to true. */
  analytics?: boolean;
}
