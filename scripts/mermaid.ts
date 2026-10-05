import fs from "node:fs/promises";
import path from "node:path";
import { assert, escapeHtml, output, root } from "./site.ts";
import type { MermaidPageCopy } from "../src/shared/page-copy.ts";

export const mermaidEditorRoute = "tools/mermaid/editor";

export function renderMermaid(copy: MermaidPageCopy, backLabel: string): string {
  return `<header class="mermaid-intro">
    <a class="tools-back" href="/tools/"><span aria-hidden="true">&larr;</span> ${escapeHtml(backLabel)}</a>
    <h1 id="mermaid-heading">${escapeHtml(copy.heading)}</h1>
    <p>${escapeHtml(copy.introduction)}</p>
  </header>
  <section class="mermaid-tool" aria-labelledby="mermaid-heading"
    data-loading-message="${escapeHtml(copy.loadingMessage)}"
    data-ready-message="${escapeHtml(copy.readyMessage)}"
    data-load-error-message="${escapeHtml(copy.loadErrorMessage)}"
    data-editor-error-message="${escapeHtml(copy.editorErrorMessage)}"
    data-fullscreen-error-message="${escapeHtml(copy.fullscreenErrorMessage)}"
    data-fullscreen-label="${escapeHtml(copy.fullscreenLabel)}"
    data-exit-fullscreen-label="${escapeHtml(copy.exitFullscreenLabel)}">
    <details class="mermaid-help">
      <summary>${escapeHtml(copy.helpLabel)}</summary>
      <p>${escapeHtml(copy.instructions)}</p>
      <p>${escapeHtml(copy.privacyHint)}</p>
      <p>${escapeHtml(copy.compatibilityHint)}</p>
    </details>
    <div class="mermaid-workspace">
      <div class="mermaid-toolbar">
        <p id="mermaid-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(copy.noScriptMessage)}</p>
        <button class="button" id="mermaid-fullscreen" type="button" disabled hidden>${escapeHtml(copy.fullscreenLabel)}</button>
      </div>
      <div class="mermaid-recovery"
        data-off-message="${escapeHtml(copy.recoveryOffMessage)}"
        data-pending-message="${escapeHtml(copy.recoveryPendingMessage)}"
        data-saved-message="${escapeHtml(copy.recoverySavedMessage)}"
        data-error-message="${escapeHtml(copy.recoveryErrorMessage)}"
        data-limit-message="${escapeHtml(copy.recoveryLimitMessage)}"
        data-restoring-message="${escapeHtml(copy.recoveryRestoringMessage)}"
        data-restore-error-message="${escapeHtml(copy.recoveryRestoreErrorMessage)}">
        <label><input id="mermaid-recovery-enabled" type="checkbox" disabled> ${escapeHtml(copy.recoveryLabel)}</label>
        <button id="mermaid-restore" class="button" type="button" disabled hidden>${escapeHtml(copy.restoreLabel)}</button>
        <button id="mermaid-forget" class="button" type="button" disabled hidden>${escapeHtml(copy.forgetLabel)}</button>
        <p id="mermaid-recovery-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(copy.recoveryOffMessage)}</p>
      </div>
      <iframe id="mermaid-editor" title="${escapeHtml(copy.editorLabel)}"
        data-editor-path="/${mermaidEditorRoute}/"
        sandbox="allow-scripts allow-same-origin allow-downloads"
        referrerpolicy="no-referrer" hidden></iframe>
    </div>
    <p class="mermaid-hint"><a href="https://github.com/archyne/archyne">${escapeHtml(copy.attributionLabel)}</a>
      &middot; <a href="/${mermaidEditorRoute}/THIRD-PARTY-NOTICES.txt">${escapeHtml(copy.licenseLabel)}</a></p>
  </section>`;
}

export async function buildMermaidEditor(copy: MermaidPageCopy): Promise<void> {
  const packageRoot = path.join(root, "node_modules", "archyne");
  const vendor = path.join(packageRoot, "dist");
  const destination = path.join(output, mermaidEditorRoute);
  const upstream = await fs.readFile(path.join(vendor, "index.html"), "utf8");
  const script = upstream.match(
    /<script type="module" crossorigin src="(\.\/assets\/[-\w]+\.js)"><\/script>/,
  )?.[1];
  const stylesheet = upstream.match(
    /<link rel="stylesheet" crossorigin href="(\.\/assets\/[-\w]+\.css)">/,
  )?.[1];
  assert(
    script && stylesheet,
    "Archyne entry points changed; review the pinned integration before updating.",
  );
  await fs.mkdir(destination, { recursive: true });
  await fs.cp(path.join(vendor, "assets"), path.join(destination, "assets"), { recursive: true });
  for (const file of ["logo.svg", "logo.png"]) {
    await fs.copyFile(path.join(vendor, file), path.join(destination, file));
  }
  for (const [source, target] of [
    ["LICENSE", "LICENSE.txt"],
    ["NOTICE", "NOTICE.txt"],
    ["THIRD-PARTY-NOTICES.md", "THIRD-PARTY-NOTICES.txt"],
  ] as const) {
    await fs.copyFile(path.join(packageRoot, source), path.join(destination, target));
  }
  // Own the shell, not the editor: keep upstream bundles unchanged and restrict them to local assets.
  await fs.writeFile(
    path.join(destination, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'">
    <title>${escapeHtml(copy.editorLabel)}</title>
    <link rel="icon" href="./logo.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" sizes="180x180" href="/tools/apple-touch-icon.png">
    <link rel="stylesheet" href="${stylesheet}">
    <script type="module" src="/assets/js/mermaid-embed.js"></script>
    <script type="module" src="${script}"></script>
  </head>
  <body>
    <div id="root"><p>${escapeHtml(copy.noScriptMessage)}</p></div>
  </body>
</html>
`,
  );
}
