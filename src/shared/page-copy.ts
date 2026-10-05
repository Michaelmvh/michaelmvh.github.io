import type { DocumentEditorCopy } from "./document-copy.ts";
import type { UrlInspectorCopy, TextUtilitiesCopy } from "./utility-copy.ts";

/** Reusable page-level copy from pages.json. */
export interface PageCopy {
  title: string;
  /** SEO/social summary; homepage falls back to site.json when empty. */
  description: string;
}

export interface HomePageCopy extends PageCopy {
  /** Optional escaped paragraph; an empty string renders nothing. */
  introduction: string;
  newsHeading: string;
}

export interface IndexPageCopy extends PageCopy {
  eyebrow: string;
  heading: string;
  introduction: string;
}

export interface ProjectPageCopy extends IndexPageCopy {
  filterLabel: string;
  allLabel: string;
  detailLabel: string;
  backLabel: string;
  screenshotsLabel: string;
}

export interface PublicationPageCopy extends IndexPageCopy {
  doiLabel: string;
  pdfLabel: string;
  copyLabel: string;
  copiedMessage: string;
  copyErrorMessage: string;
}

export interface SharedCopy {
  skipLink: string;
  defaultThemeLabel: string;
  defaultThemeActive: string;
  returnToDefaultTheme: string;
  menuLabel: string;
  navigationLabel: string;
  socialNavigationLabel: string;
  externalLinkHint: string;
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

export interface ToolsPageCopy extends IndexPageCopy {
  backLabel: string;
  documentEditor: DocumentEditorCopy;
}

export interface DocumentToolPageCopy extends IndexPageCopy {
  originalLabel: string;
  revisedLabel: string;
  inputHint: string;
  optionLabel: string;
}

export interface MermaidPageCopy extends IndexPageCopy {
  helpLabel: string;
  recoveryLabel: string;
  restoreLabel: string;
  forgetLabel: string;
  recoveryOffMessage: string;
  recoveryPendingMessage: string;
  recoverySavedMessage: string;
  recoveryErrorMessage: string;
  recoveryLimitMessage: string;
  recoveryRestoringMessage: string;
  recoveryRestoreErrorMessage: string;
  instructions: string;
  privacyHint: string;
  compatibilityHint: string;
  editorLabel: string;
  fullscreenLabel: string;
  exitFullscreenLabel: string;
  attributionLabel: string;
  licenseLabel: string;
  noScriptMessage: string;
  loadingMessage: string;
  readyMessage: string;
  loadErrorMessage: string;
  editorErrorMessage: string;
  fullscreenErrorMessage: string;
}

export interface QrCodePageCopy extends IndexPageCopy {
  inputLabel: string;
  inputHint: string;
  placeholder: string;
  previewLabel: string;
  emptyPreview: string;
  pngLabel: string;
  svgLabel: string;
  clearLabel: string;
  downloadHint: string;
  loadingMessage: string;
  emptyMessage: string;
  readyMessage: string;
  tooLongMessage: string;
  errorMessage: string;
  loadErrorMessage: string;
  noScriptMessage: string;
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
export interface PageCopyMap {
  _instructions: PageInstructions;
  shared: SharedCopy;
  lightbox: {
    heading: string;
    openLabel: string;
    closeLabel: string;
    loadingMessage: string;
    errorMessage: string;
    retryLabel: string;
  };
  home: HomePageCopy;
  publications: PublicationPageCopy;
  projects: ProjectPageCopy;
  baking: BakingPageCopy;
  other: IndexPageCopy;
  cv: CvPageCopy;
  notFound: NotFoundPageCopy;
  styleOptions: PageCopy;
  styleBlueprint: PageCopy;
  mermaid: MermaidPageCopy;
  tools: ToolsPageCopy;
  qrCode: QrCodePageCopy;
  jsonFormatter: DocumentToolPageCopy;
  textDiff: DocumentToolPageCopy;
  urlInspector: IndexPageCopy & UrlInspectorCopy;
  textUtilities: IndexPageCopy & TextUtilitiesCopy;
}
