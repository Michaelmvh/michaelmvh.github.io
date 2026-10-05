import { escapeHtml } from "./site.ts";
import { renderToolHeader } from "./tools.ts";
import type { DocumentToolPageCopy, ToolsPageCopy } from "../src/shared/page-copy.ts";

export function renderDocumentTool(
  page: DocumentToolPageCopy,
  tools: ToolsPageCopy,
  mode: "json" | "text",
): string {
  const copy = tools.documentEditor;
  const input = (id: string, label: string): string => `<div class="document-input">
    <label for="${id}">${escapeHtml(label)}</label>
    <textarea id="${id}" rows="12" spellcheck="false" autocomplete="off" autocapitalize="off"
      aria-describedby="document-hint document-status"></textarea>
  </div>`;
  return `${renderToolHeader(page, tools.backLabel, "document-heading")}
  <section class="document-tool" data-mode="${mode}" aria-labelledby="document-heading">
    <script type="application/json" id="document-copy">${JSON.stringify(copy).replaceAll("<", "\\u003c")}</script>
    <p id="document-hint" class="document-hint">${escapeHtml(page.inputHint)}</p>
    <fieldset id="document-controls" disabled>
      <legend class="sr-only">${escapeHtml(page.heading)}</legend>
      <div class="document-inputs">
        ${input("document-original", page.originalLabel)}
        ${input("document-revised", page.revisedLabel)}
      </div>
      <label class="document-option"><input type="checkbox" id="document-option"> ${escapeHtml(page.optionLabel)}</label>
      <div class="document-actions">
${
  mode === "json"
    ? `<button class="button" id="document-format" type="button">${escapeHtml(copy.formatLabel)}</button>
        <button class="button" id="document-minify" type="button">${escapeHtml(copy.minifyLabel)}</button>`
    : ""
}
        <button class="button" id="document-clear" type="button">${escapeHtml(copy.clearLabel)}</button>
      </div>
    </fieldset>
    <p id="document-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(copy.noScriptMessage)}</p>
${
  mode === "json"
    ? `<section id="document-formatted" aria-labelledby="formatted-heading" hidden>
      <h2 id="formatted-heading"><label for="document-output">${escapeHtml(copy.formattedHeading)}</label></h2>
      <p id="document-output-status" role="status" aria-live="polite" aria-atomic="true"></p>
      <textarea id="document-output" rows="12" readonly spellcheck="false"></textarea>
      <div class="document-actions">
        <button class="button" id="document-copy-button" type="button">${escapeHtml(copy.copyLabel)}</button>
        <a class="button" id="document-download">${escapeHtml(copy.downloadLabel)}</a>
      </div>
    </section>`
    : ""
}
    <section id="document-diff" aria-labelledby="diff-heading" hidden>
      <h2 id="diff-heading">${escapeHtml(copy.diffHeading)}</h2>
      <p id="diff-summary"></p>
      <ol class="diff-lines" id="diff-lines"></ol>
    </section>
  </section>`;
}
