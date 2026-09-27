export const recoveryKey = "mermaid-recovery-v1";
export const recoveryLimit = 500_000;

type EditorRequest = { type: "getCode" } | { type: "load"; code: string };

export function createRecovery(send: (message: EditorRequest) => void) {
  const root = document.querySelector<HTMLElement>(".mermaid-recovery");
  const enabled = document.querySelector<HTMLInputElement>("#mermaid-recovery-enabled");
  const restore = document.querySelector<HTMLButtonElement>("#mermaid-restore");
  const forget = document.querySelector<HTMLButtonElement>("#mermaid-forget");
  const status = document.querySelector<HTMLElement>("#mermaid-recovery-status");
  if (!root || !enabled || !restore || !forget || !status) {
    throw new Error("Missing Mermaid recovery controls");
  }
  const report = (key: string) => {
    const message = root.dataset[key];
    if (!message) throw new Error(`Missing Mermaid recovery copy: ${key}`);
    status.textContent = message;
  };
  let pending: string | null = null;
  let stored: string | null = null;
  let ready = false;
  let restoring = false;
  let restoreTimer: number | undefined;

  const controls = () => {
    enabled.disabled = !ready || pending !== null;
    restore.hidden = pending === null;
    restore.disabled = !ready || restoring || pending === null || pending.length > recoveryLimit;
    forget.hidden = stored === null;
    forget.disabled = !ready || restoring;
  };

  const storageError = (error: unknown) => {
    console.error("Mermaid recovery storage failed", error);
    enabled.checked = false;
    report("errorMessage");
    controls();
  };

  const save = (code: string) => {
    if (!enabled.checked || pending !== null) return;
    if (code.length > recoveryLimit) {
      enabled.checked = false;
      report("limitMessage");
      return;
    }
    try {
      localStorage.setItem(recoveryKey, code);
      stored = code;
      controls();
      report("savedMessage");
    } catch (error: unknown) {
      storageError(error);
    }
  };

  const forgetDraft = () => {
    try {
      localStorage.removeItem(recoveryKey);
      pending = stored = null;
      enabled.checked = false;
      controls();
      report("offMessage");
    } catch (error: unknown) {
      storageError(error);
    }
  };

  function restoreFailed() {
    restoring = false;
    window.clearTimeout(restoreTimer);
    controls();
    report("restoreErrorMessage");
  }

  enabled.addEventListener("change", () => {
    if (enabled.checked) send({ type: "getCode" });
    else forgetDraft();
  });
  forget.addEventListener("click", forgetDraft);
  restore.addEventListener("click", () => {
    if (pending === null) return;
    restoring = true;
    controls();
    report("restoringMessage");
    restoreTimer = window.setTimeout(restoreFailed, 30_000);
    send({ type: "load", code: pending });
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== recoveryKey && event.key !== null) return;
    window.clearTimeout(restoreTimer);
    restoring = false;
    enabled.checked = false;
    pending = stored = event.newValue;
    controls();
    report(pending === null ? "offMessage" : "pendingMessage");
  });

  return {
    ready() {
      if (ready) return;
      ready = true;
      try {
        pending = stored = localStorage.getItem(recoveryKey);
        controls();
        if (pending !== null) report("pendingMessage");
      } catch (error: unknown) {
        storageError(error);
      }
    },
    receive(message: object & { type: unknown }) {
      if (message.type === "loaded" && restoring) {
        window.clearTimeout(restoreTimer);
        restoring = false;
        pending = null;
        enabled.checked = true;
        controls();
        report("savedMessage");
      } else if (message.type === "error" && restoring) {
        restoreFailed();
      } else if (
        (message.type === "change" || message.type === "code") &&
        "code" in message &&
        typeof message.code === "string"
      ) {
        save(message.code);
      }
    },
  };
}
