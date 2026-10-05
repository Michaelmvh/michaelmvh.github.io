import { escapeHtml } from "./site.ts";
import { renderToolHeader } from "./tools.ts";
import type { IndexPageCopy } from "../src/shared/page-copy.ts";
import type { UtilityCopy, UrlInspectorCopy, TextUtilitiesCopy } from "../src/shared/utility-copy.ts";

function renderUtility(
  page: IndexPageCopy & UtilityCopy,
  backLabel: string,
  content: string,
  mode: string,
): string {
  return `${renderToolHeader(page, backLabel, "utility-heading")}
  <section class="document-tool utility-tool" data-mode="${mode}" aria-labelledby="utility-heading">
    <script type="application/json" id="utility-copy-data">${JSON.stringify(page).replaceAll("<", "\\u003c")}</script>
    <p class="document-hint" id="utility-hint">${escapeHtml(page.inputHint)}</p>
    <fieldset id="utility-controls" disabled>
      <legend class="sr-only">${escapeHtml(page.heading)}</legend>
      <div class="document-input">
        <label for="utility-input">${escapeHtml(page.inputLabel)}</label>
        <textarea id="utility-input" rows="${mode === "url" ? 3 : 9}" spellcheck="false" autocomplete="off"
          autocapitalize="off" aria-describedby="utility-hint utility-status"></textarea>
      </div>
      ${content.trim()}
      <div class="document-actions">
        <button class="button" type="button" id="utility-clear">${escapeHtml(page.clearLabel)}</button>
      </div>
    </fieldset>
    <p id="utility-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(page.noScriptMessage)}</p>
    <div class="document-input">
      <h2><label for="utility-output">${escapeHtml(page.outputLabel)}</label></h2>
      <textarea id="utility-output" rows="${mode === "url" ? 3 : 9}" readonly spellcheck="false"></textarea>
${mode === "text" ? '      <p class="document-hint" id="text-output-count"></p>' : ""}
    </div>
    <div class="document-actions">
      <button class="button" id="utility-copy" type="button" disabled>${escapeHtml(page.copyLabel)}</button>
      <a class="button" id="utility-download" hidden>${escapeHtml(page.downloadLabel)}</a>
    </div>
    <p id="utility-feedback" role="status" aria-live="polite" aria-atomic="true"></p>
  </section>`;
}

export function renderUrlInspector(page: IndexPageCopy & UrlInspectorCopy, backLabel: string): string {
  return renderUtility(
    page,
    backLabel,
    `
    <section id="url-inspection" hidden>
      <h2>${escapeHtml(page.componentsHeading)}</h2>
      <dl class="url-components">${(
        [
          ["protocol", page.schemeLabel],
          ["origin", page.originLabel],
          ["hostname", page.hostnameLabel],
          ["port", page.portLabel],
          ["pathname", page.pathLabel],
          ["hash", page.fragmentLabel],
        ] as const
      )
        .map(([key, label]) => `<div><dt>${escapeHtml(label)}</dt><dd id="url-${key}"></dd></div>`)
        .join("")}</dl>
      <p id="url-credentials" class="document-hint" hidden>${escapeHtml(page.credentialsMessage)}</p>
      <h2>${escapeHtml(page.parametersHeading)}</h2>
      <p class="document-hint">${escapeHtml(page.parametersHint)}</p>
      <ol id="url-parameters" class="url-parameters"></ol>
      <div class="document-actions">
        <button class="button" type="button" id="url-add">${escapeHtml(page.addLabel)}</button>
        <button class="button" type="button" id="url-select-tracking">${escapeHtml(page.selectTrackingLabel)}</button>
        <button class="button" type="button" id="url-remove" disabled>${escapeHtml(page.removeSelectedLabel)}</button>
      </div>
    </section>`,
    "url",
  );
}

export function renderTextUtilities(page: IndexPageCopy & TextUtilitiesCopy, backLabel: string): string {
  return renderUtility(
    page,
    backLabel,
    `
    <p class="document-hint" id="text-input-count"></p>
    <div class="utility-options">
      <label for="text-case">${escapeHtml(page.caseLabel)}</label>
      <select id="text-case">
        <option value="unchanged">${escapeHtml(page.unchangedLabel)}</option>
        <option value="lower">${escapeHtml(page.lowerLabel)}</option>
        <option value="upper">${escapeHtml(page.upperLabel)}</option>
        <option value="capitalize">${escapeHtml(page.capitalizeLabel)}</option>
      </select>
      <label for="text-sort">${escapeHtml(page.sortLabel)}</label>
      <select id="text-sort">
        <option value="none">${escapeHtml(page.originalOrderLabel)}</option>
        <option value="ascending">${escapeHtml(page.ascendingLabel)}</option>
        <option value="descending">${escapeHtml(page.descendingLabel)}</option>
      </select>
    </div>
    ${(
      [
        ["text-trim", page.trimLabel],
        ["text-blank", page.removeBlankLabel],
        ["text-dedupe", page.deduplicateLabel],
      ] as const
    )
      .map(
        ([id, label]) =>
          `<label class="document-option"><input type="checkbox" id="${id}"> ${escapeHtml(label)}</label>`,
      )
      .join("")}`,
    "text",
  );
}
