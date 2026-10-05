import { checkDocumentLimits, DocumentInputError } from "./document-limits.ts";
import { message, required } from "./utility-common.ts";
import type { DocumentEditorCopy } from "../../scripts/document-copy.js";
import type { ComparedLine } from "./document-diff.ts";

const tool = required(".document-tool", HTMLElement);
const controls = required("#document-controls", HTMLFieldSetElement);
const original = required("#document-original", HTMLTextAreaElement);
const revised = required("#document-revised", HTMLTextAreaElement);
const option = required("#document-option", HTMLInputElement);
const status = required("#document-status", HTMLElement);
const diffSection = required("#document-diff", HTMLElement);
const diffSummary = required("#diff-summary", HTMLElement);
const diffLines = required("#diff-lines", HTMLOListElement);
const copy: DocumentEditorCopy = JSON.parse(required("#document-copy", HTMLScriptElement).textContent);
const isJson = tool.dataset.mode === "json";
const formatted = isJson
  ? {
      section: required("#document-formatted", HTMLElement),
      output: required("#document-output", HTMLTextAreaElement),
      status: required("#document-output-status", HTMLElement),
      copy: required("#document-copy-button", HTMLButtonElement),
      download: required("#document-download", HTMLAnchorElement),
    }
  : undefined;
let downloadUrl: string | undefined;
let revision = 0;
let comparisonTimer: ReturnType<typeof setTimeout> | undefined;
let composing = false;

function clearErrors(): void {
  original.removeAttribute("aria-invalid");
  revised.removeAttribute("aria-invalid");
}

function clearDiff(): void {
  diffSection.hidden = true;
  diffSection.removeAttribute("aria-busy");
  diffSummary.textContent = "";
  diffLines.replaceChildren();
}

function resetFormatted(): void {
  revision++;
  if (formatted) {
    formatted.section.hidden = true;
    formatted.output.value = "";
    formatted.status.textContent = "";
    formatted.download.removeAttribute("href");
    formatted.download.removeAttribute("download");
  }
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
}

function showError(error: unknown, input: HTMLTextAreaElement): void {
  if (!(error instanceof DocumentInputError)) {
    status.textContent = copy.errorMessage;
    console.error("Document tool failed", error);
    return;
  }
  const inputLabel = input.labels?.[0]?.textContent ?? input.id;
  if (error.kind === "syntax" || error.kind === "duplicate") {
    input.setAttribute("aria-invalid", "true");
    const before = input.value.slice(0, error.offset).split(/\r\n|\r|\n/);
    status.textContent = message(error.kind === "syntax" ? copy.syntaxMessage : copy.duplicateMessage, {
      input: inputLabel,
      line: before.length,
      column: (before.at(-1)?.length ?? 0) + 1,
      reason: error.reason,
    });
  } else if (error.kind === "depth") {
    input.setAttribute("aria-invalid", "true");
    status.textContent = message(copy.depthMessage, { input: inputLabel });
  } else {
    status.textContent = error.kind === "limit" ? copy.limitMessage : copy.comparisonLimitMessage;
  }
}

function renderDiff(changes: ComparedLine[]): void {
  const fragment = document.createDocumentFragment();
  let added = 0;
  let removed = 0;
  for (const change of changes) {
    const kind = change.added ? "added" : change.removed ? "removed" : "unchanged";
    if (change.added) added += change.count;
    if (change.removed) removed += change.count;
    const line = document.createElement("li");
    line.className = `diff-line diff-${kind}`;
    const label = document.createElement("span");
    label.className = "sr-only";
    label.textContent = `${copy[`${kind}Label`]}: `;
    const sign = document.createElement("span");
    sign.className = "diff-sign";
    sign.setAttribute("aria-hidden", "true");
    sign.textContent = change.added ? "+" : change.removed ? "-" : " ";
    const content = document.createElement("code");
    for (const part of change.parts) {
      const value = part.value.replace(/\n$/, "");
      if (!value) continue;
      if (part.changed) {
        const highlight = document.createElement(change.added ? "ins" : "del");
        highlight.className = "diff-highlight";
        highlight.textContent = value;
        content.append(highlight);
      } else {
        content.append(document.createTextNode(value));
      }
    }
    line.append(label, sign, content);
    if (!isJson && !change.value.endsWith("\n")) {
      const marker = document.createElement("span");
      marker.className = "diff-eof";
      marker.textContent = copy.noNewlineLabel;
      line.append(marker);
    }
    fragment.append(line);
  }
  diffLines.replaceChildren(fragment);
  diffSummary.textContent =
    added || removed ? message(copy.summaryMessage, { added, removed }) : copy.identicalMessage;
  diffSection.hidden = false;
  diffSection.removeAttribute("aria-busy");
  status.textContent = diffSummary.textContent;
}

try {
  const [{ compareDocuments }, json] = await Promise.all([
    import("./document-diff.ts"),
    isJson ? import("./json-format.ts") : undefined,
  ]);

  const updateComparison = (): void => {
    comparisonTimer = undefined;
    clearErrors();
    if (!original.value && !revised.value) {
      clearDiff();
      status.textContent = copy.readyMessage;
      return;
    }
    let current = original;
    try {
      checkDocumentLimits(original.value);
      const before = json
        ? original.value.trim()
          ? json.formatJson(original.value, false, option.checked)
          : undefined
        : original.value;
      current = revised;
      checkDocumentLimits(revised.value);
      const after = json
        ? revised.value.trim()
          ? json.formatJson(revised.value, false, option.checked)
          : undefined
        : revised.value;
      if (before === undefined || after === undefined) {
        clearDiff();
        status.textContent = copy.waitingMessage;
        return;
      }
      renderDiff(compareDocuments(before, after, !isJson && option.checked));
    } catch (error: unknown) {
      clearDiff();
      showError(error, current);
    }
  };

  const scheduleComparison = (): void => {
    clearTimeout(comparisonTimer);
    clearErrors();
    diffSection.setAttribute("aria-busy", "true");
    status.textContent = copy.editedMessage;
    if (!composing) comparisonTimer = setTimeout(updateComparison, 200);
  };

  if (formatted && json) {
    for (const [id, compact] of [
      ["#document-format", false],
      ["#document-minify", true],
    ] as const) {
      required(id, HTMLButtonElement).addEventListener("click", () => {
        resetFormatted();
        try {
          const result = json.formatJson(original.value, compact, option.checked);
          downloadUrl = URL.createObjectURL(new Blob([result], { type: "application/json" }));
          formatted.download.href = downloadUrl;
          formatted.download.download = "formatted.json";
          formatted.output.value = result;
          formatted.copy.disabled = false;
          formatted.section.hidden = false;
          formatted.status.textContent = copy.formattedMessage;
        } catch (error: unknown) {
          clearDiff();
          showError(error, original);
        }
      });
    }
    formatted.copy.addEventListener("click", async () => {
      const currentRevision = revision;
      formatted.copy.disabled = true;
      try {
        await navigator.clipboard.writeText(formatted.output.value);
        if (revision === currentRevision) formatted.status.textContent = copy.copiedMessage;
      } catch (error: unknown) {
        if (revision === currentRevision) formatted.status.textContent = copy.copyErrorMessage;
        console.error("JSON clipboard copy failed", error);
      } finally {
        if (revision === currentRevision) formatted.copy.disabled = false;
      }
    });
  }

  for (const input of [original, revised, option]) {
    input.addEventListener("input", () => {
      if (input !== revised) resetFormatted();
      scheduleComparison();
    });
  }
  for (const input of [original, revised]) {
    input.addEventListener("compositionstart", () => {
      composing = true;
      clearTimeout(comparisonTimer);
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      scheduleComparison();
    });
  }
  required("#document-clear", HTMLButtonElement).addEventListener("click", () => {
    clearTimeout(comparisonTimer);
    composing = false;
    original.value = "";
    revised.value = "";
    clearErrors();
    clearDiff();
    resetFormatted();
    status.textContent = copy.readyMessage;
    original.focus();
  });
  controls.disabled = false;
  status.textContent = copy.readyMessage;
} catch (error: unknown) {
  status.textContent = copy.loadErrorMessage;
  console.error("Document tool failed to load", error);
}
