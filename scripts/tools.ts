import { escapeHtml } from "./site.ts";
import type { QrCodePageCopy, Tool, ToolsPageCopy } from "./types.ts";

export function renderTools(copy: ToolsPageCopy, tools: Tool[]): string {
  return `<header class="page-intro tools-intro">
    <p class="eyebrow">${escapeHtml(copy.eyebrow)}</p>
    <h1>${escapeHtml(copy.heading)}</h1>
    <p>${escapeHtml(copy.introduction)}</p>
  </header>
  <ul class="tools-grid">${tools
    .map(
      (tool) => `<li>
      <a class="tool-card" href="/tools/${escapeHtml(tool.slug)}/" aria-labelledby="tool-${escapeHtml(tool.slug)}">
        <h2 id="tool-${escapeHtml(tool.slug)}">${escapeHtml(tool.name)} <span aria-hidden="true">&rarr;</span></h2>
        <p>${escapeHtml(tool.description)}</p>
      </a>
    </li>`,
    )
    .join("")}</ul>`;
}

export function renderQrCode(copy: QrCodePageCopy, backLabel: string): string {
  return `<header class="page-intro tools-intro">
    <a class="tools-back" href="/tools/"><span aria-hidden="true">&larr;</span> ${escapeHtml(backLabel)}</a>
    <p class="eyebrow">${escapeHtml(copy.eyebrow)}</p>
    <h1 id="qr-heading">${escapeHtml(copy.heading)}</h1>
    <p>${escapeHtml(copy.introduction)}</p>
  </header>
  <section class="qr-tool" aria-labelledby="qr-heading"
    data-empty-message="${escapeHtml(copy.emptyMessage)}"
    data-ready-message="${escapeHtml(copy.readyMessage)}"
    data-too-long-message="${escapeHtml(copy.tooLongMessage)}"
    data-error-message="${escapeHtml(copy.errorMessage)}"
    data-loading-message="${escapeHtml(copy.loadingMessage)}"
    data-load-error-message="${escapeHtml(copy.loadErrorMessage)}">
    <div class="qr-workspace">
      <div class="qr-controls">
        <label for="qr-input">${escapeHtml(copy.inputLabel)}</label>
        <p id="qr-hint" class="qr-hint">${escapeHtml(copy.inputHint)}</p>
        <textarea id="qr-input" rows="6" placeholder="${escapeHtml(copy.placeholder)}"
          aria-describedby="qr-hint qr-status" spellcheck="false" autocomplete="off"
          autocapitalize="off" disabled></textarea>
        <button class="button" id="qr-clear" type="button" disabled>${escapeHtml(copy.clearLabel)}</button>
        <p id="qr-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(copy.noScriptMessage)}</p>
      </div>
      <div class="qr-result">
        <div class="qr-preview" data-preview-label="${escapeHtml(copy.previewLabel)}">
          <p id="qr-empty">${escapeHtml(copy.emptyPreview)}</p>
        </div>
        <div id="qr-downloads" class="qr-downloads" hidden>
          <a class="button" id="qr-png">${escapeHtml(copy.pngLabel)}</a>
          <a class="button" id="qr-svg">${escapeHtml(copy.svgLabel)}</a>
        </div>
        <p class="qr-hint">${escapeHtml(copy.downloadHint)}</p>
      </div>
    </div>
  </section>`;
}
