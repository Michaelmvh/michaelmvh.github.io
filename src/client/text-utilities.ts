import type { TextUtilitiesCopy } from "../shared/utility-copy.ts";
import { DocumentInputError } from "./document-limits.ts";
import { createOutput, message, required } from "./utility-common.ts";
import { countText, transformText } from "./text-utilities-model.ts";
import type { TextOptions } from "./text-utilities-model.ts";

const copy: TextUtilitiesCopy = JSON.parse(required("#utility-copy-data", HTMLScriptElement).textContent);
const input = required("#utility-input", HTMLTextAreaElement);
const status = required("#utility-status", HTMLElement);
const letterCase = required("#text-case", HTMLSelectElement);
const sort = required("#text-sort", HTMLSelectElement);
const trim = required("#text-trim", HTMLInputElement);
const blank = required("#text-blank", HTMLInputElement);
const dedupe = required("#text-dedupe", HTMLInputElement);
const inputCount = required("#text-input-count", HTMLElement);
const outputCount = required("#text-output-count", HTMLElement);
const output = createOutput(copy, "text.txt");
let timer: number | undefined;
let composing = false;

function options(): TextOptions {
  const caseValue = letterCase.value;
  const sortValue = sort.value;
  if (
    caseValue !== "unchanged" &&
    caseValue !== "lower" &&
    caseValue !== "upper" &&
    caseValue !== "capitalize"
  ) {
    throw new Error("Unknown text case option");
  }
  if (sortValue !== "none" && sortValue !== "ascending" && sortValue !== "descending") {
    throw new Error("Unknown text sort option");
  }
  return {
    letterCase: caseValue,
    sort: sortValue,
    trimLines: trim.checked,
    removeBlank: blank.checked,
    deduplicate: dedupe.checked,
  };
}

function update(): void {
  timer = undefined;
  try {
    const value = transformText(input.value, options());
    inputCount.textContent = message(copy.countMessage, countText(input.value));
    outputCount.textContent = message(copy.countMessage, countText(value));
    output.set(input.value ? value : null);
    input.removeAttribute("aria-invalid");
    status.textContent = input.value ? copy.updatedMessage : copy.readyMessage;
  } catch (error: unknown) {
    output.set(null);
    inputCount.textContent = "";
    outputCount.textContent = "";
    input.setAttribute("aria-invalid", "true");
    if (error instanceof DocumentInputError) status.textContent = copy.limitMessage;
    else {
      status.textContent = copy.errorMessage;
      console.error("Text utilities failed", error);
    }
  }
}

function schedule(): void {
  window.clearTimeout(timer);
  output.pending();
  status.textContent = copy.updatingMessage;
  if (!composing) timer = window.setTimeout(update, 200);
}

input.addEventListener("input", schedule);
for (const control of [letterCase, sort, trim, blank, dedupe]) control.addEventListener("change", schedule);
input.addEventListener("compositionstart", () => {
  composing = true;
  schedule();
});
input.addEventListener("compositionend", () => {
  composing = false;
  schedule();
});
required("#utility-clear", HTMLButtonElement).addEventListener("click", () => {
  window.clearTimeout(timer);
  composing = false;
  input.value = "";
  update();
  input.focus();
});
required("#utility-controls", HTMLFieldSetElement).disabled = false;
update();
