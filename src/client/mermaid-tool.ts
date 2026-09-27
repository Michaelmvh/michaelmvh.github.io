import { createRecovery } from "./mermaid-recovery.ts";

const tool = document.querySelector<HTMLElement>(".mermaid-tool");
const frame = document.querySelector<HTMLIFrameElement>("#mermaid-editor");
const status = document.querySelector<HTMLElement>("#mermaid-status");
const workspace = document.querySelector<HTMLElement>(".mermaid-workspace");
const fullscreen = document.querySelector<HTMLButtonElement>("#mermaid-fullscreen");

if (tool && frame && status && workspace && fullscreen) {
  const copy = (key: string): string => {
    const value = tool.dataset[key];
    if (!value) throw new Error(`Missing Mermaid copy: ${key}`);
    return value;
  };
  const editorPath = frame.dataset.editorPath;
  if (!editorPath) throw new Error("Missing Mermaid editor path");
  const url = new URL(editorPath, location.origin);
  url.searchParams.set("embed", "1");
  url.searchParams.set("origin", location.origin);
  const recovery = createRecovery((message) => frame.contentWindow?.postMessage(message, url.origin));
  let ready = false;
  const timeout = window.setTimeout(() => {
    if (!ready) status.textContent = copy("loadErrorMessage");
  }, 30_000);

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== url.origin || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (typeof message !== "object" || message === null || !("type" in message)) return;
    if (message.type === "ready") {
      ready = true;
      window.clearTimeout(timeout);
      status.textContent = copy("readyMessage");
      fullscreen.disabled = false;
      recovery.ready();
    } else if (message.type === "error" && "message" in message && typeof message.message === "string") {
      status.textContent = `${copy("editorErrorMessage")} ${message.message}`;
    }
    recovery.receive(message);
  });

  fullscreen.hidden = !document.fullscreenEnabled;
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await workspace.requestFullscreen();
    } catch (error: unknown) {
      console.error("Mermaid full screen failed", error);
      status.textContent = copy("fullscreenErrorMessage");
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = copy(document.fullscreenElement ? "exitFullscreenLabel" : "fullscreenLabel");
    if (!document.fullscreenElement) fullscreen.focus();
  });
  frame.addEventListener("error", () => {
    window.clearTimeout(timeout);
    status.textContent = copy("loadErrorMessage");
  });
  status.textContent = copy("loadingMessage");
  frame.src = url.href;
  frame.hidden = false;
}
