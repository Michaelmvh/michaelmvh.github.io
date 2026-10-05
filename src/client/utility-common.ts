import type { UtilityCopy } from "../../scripts/utility-copy.js";

export function required<T extends HTMLElement>(selector: string, type: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing utility element: ${selector}`);
  return element;
}

export function message(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (token: string, key: string) => String(values[key] ?? token));
}

export function createOutput(copy: UtilityCopy, filename: string) {
  const output = required("#utility-output", HTMLTextAreaElement);
  const copyButton = required("#utility-copy", HTMLButtonElement);
  const download = required("#utility-download", HTMLAnchorElement);
  const feedback = required("#utility-feedback", HTMLElement);
  let revision = 0;
  let current: string | null = null;
  let blobUrl: string | undefined;

  const invalidate = () => {
    revision++;
    current = null;
    copyButton.disabled = true;
    download.hidden = true;
    download.removeAttribute("href");
    feedback.textContent = "";
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = undefined;
  };

  copyButton.addEventListener("click", async () => {
    if (current === null) return;
    const attempt = ++revision;
    try {
      await navigator.clipboard.writeText(current);
      if (attempt === revision) feedback.textContent = copy.copiedMessage;
    } catch (error: unknown) {
      if (attempt === revision) {
        feedback.textContent = copy.copyErrorMessage;
        console.error("Utility clipboard access failed", error);
      }
    }
  });

  return {
    pending() {
      invalidate();
      output.setAttribute("aria-busy", "true");
    },
    set(value: string | null) {
      invalidate();
      output.removeAttribute("aria-busy");
      output.value = value ?? "";
      if (value === null) return;
      current = value;
      copyButton.disabled = false;
      blobUrl = URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" }));
      download.href = blobUrl;
      download.download = filename;
      download.hidden = false;
    },
  };
}
