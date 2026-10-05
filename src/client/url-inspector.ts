import type { UrlInspectorCopy } from "../shared/utility-copy.ts";
import { createOutput, message, required } from "./utility-common.ts";
import {
  inspectUrl,
  isTrackingParameter,
  maximumUrlParameters,
  serializeUrl,
  UrlInputError,
} from "./url-inspector-model.ts";
import type { InspectedUrl, UrlParameter } from "./url-inspector-model.ts";

const copy: UrlInspectorCopy = JSON.parse(required("#utility-copy-data", HTMLScriptElement).textContent);
const input = required("#utility-input", HTMLTextAreaElement);
const status = required("#utility-status", HTMLElement);
const inspection = required("#url-inspection", HTMLElement);
const parameters = required("#url-parameters", HTMLOListElement);
const add = required("#url-add", HTMLButtonElement);
const selectTracking = required("#url-select-tracking", HTMLButtonElement);
const remove = required("#url-remove", HTMLButtonElement);
const credentials = required("#url-credentials", HTMLElement);
const output = createOutput(copy, "url.txt");
const selected = new Set<UrlParameter>();
let current: InspectedUrl | null = null;
let composing = false;

function showError(error: unknown, field: HTMLElement): void {
  output.set(null);
  field.setAttribute("aria-invalid", "true");
  if (error instanceof UrlInputError) {
    status.textContent =
      error.kind === "limit"
        ? copy.limitMessage
        : error.kind === "encoding"
          ? copy.encodingMessage
          : copy.invalidMessage;
  } else {
    status.textContent = copy.errorMessage;
    console.error("URL inspector failed", error);
  }
}

function update(field: HTMLElement = input): void {
  if (!current) return;
  add.disabled = current.parameters.length >= maximumUrlParameters;
  selectTracking.disabled = !current.parameters.some((parameter) => isTrackingParameter(parameter.name));
  remove.disabled = selected.size === 0;
  try {
    const value = serializeUrl(current);
    const url = new URL(value);
    for (const key of ["protocol", "origin", "hostname", "port", "pathname", "hash"] as const) {
      required(`#url-${key}`, HTMLElement).textContent = url[key];
    }
    credentials.hidden = !url.username && !url.password;
    output.set(value);
    document
      .querySelectorAll(".utility-tool [aria-invalid]")
      .forEach((element) => element.removeAttribute("aria-invalid"));
    status.textContent = message(copy.updatedMessage, { count: current.parameters.length });
  } catch (error: unknown) {
    showError(error, field);
  }
}

function renderParameters(): void {
  parameters.replaceChildren();
  current?.parameters.forEach((parameter, index) => {
    const row = document.createElement("li");
    row.className = "url-parameter";
    const selectionLabel = document.createElement("label");
    selectionLabel.className = "url-parameter-select";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(parameter);
    const selectionText = document.createElement("span");
    selectionText.className = "sr-only";
    selectionText.textContent = message(copy.parameterSelectLabel, { index: index + 1 });
    selectionLabel.append(checkbox, selectionText);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(parameter);
      else selected.delete(parameter);
      remove.disabled = selected.size === 0;
    });
    const badge = document.createElement("span");
    badge.className = "url-tracking";
    badge.textContent = copy.trackingLabel;
    badge.hidden = !isTrackingParameter(parameter.name);
    row.append(selectionLabel);
    for (const key of ["name", "value"] as const) {
      const label = document.createElement("label");
      label.textContent = message(key === "name" ? copy.parameterNameLabel : copy.parameterValueLabel, {
        index: index + 1,
      });
      const field = document.createElement("textarea");
      field.className = `url-parameter-${key}`;
      field.rows = 2;
      field.value = parameter[key];
      field.spellcheck = false;
      field.autocomplete = "off";
      field.setAttribute("autocapitalize", "off");
      field.addEventListener("input", () => {
        parameter[key] = field.value;
        delete parameter.raw;
        badge.hidden = !isTrackingParameter(parameter.name);
        update(field);
      });
      label.append(field);
      row.append(label);
    }
    row.append(badge);
    parameters.append(row);
  });
}

function inspect(): void {
  selected.clear();
  current = null;
  inspection.hidden = true;
  parameters.replaceChildren();
  input.removeAttribute("aria-invalid");
  if (!input.value.trim()) {
    output.set(null);
    status.textContent = copy.readyMessage;
    return;
  }
  try {
    current = inspectUrl(input.value);
    renderParameters();
    inspection.hidden = false;
    update();
  } catch (error: unknown) {
    showError(error, input);
  }
}

input.addEventListener("input", () => {
  if (!composing) inspect();
});
input.addEventListener("compositionstart", () => {
  composing = true;
  output.pending();
  inspection.hidden = true;
});
input.addEventListener("compositionend", () => {
  composing = false;
  inspect();
});
add.addEventListener("click", () => {
  if (!current) return;
  current.parameters.push({ name: "", value: "" });
  current.hasQuery = true;
  renderParameters();
  update();
  parameters.querySelector<HTMLTextAreaElement>("li:last-child .url-parameter-name")?.focus();
});
selectTracking.addEventListener("click", () => {
  current?.parameters.forEach((parameter) => {
    if (isTrackingParameter(parameter.name)) selected.add(parameter);
  });
  parameters.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox, index) => {
    const parameter = current?.parameters[index];
    checkbox.checked = parameter !== undefined && selected.has(parameter);
  });
  remove.disabled = selected.size === 0;
});
remove.addEventListener("click", () => {
  if (!current) return;
  current.parameters = current.parameters.filter((parameter) => !selected.has(parameter));
  current.hasQuery = current.parameters.length > 0;
  selected.clear();
  renderParameters();
  update();
  add.focus();
});
required("#utility-clear", HTMLButtonElement).addEventListener("click", () => {
  input.value = "";
  composing = false;
  inspect();
  input.focus();
});
required("#utility-controls", HTMLFieldSetElement).disabled = false;
inspect();
