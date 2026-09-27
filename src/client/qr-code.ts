const tool = document.querySelector<HTMLElement>(".qr-tool");
const input = document.querySelector<HTMLTextAreaElement>("#qr-input");
const clear = document.querySelector<HTMLButtonElement>("#qr-clear");
const status = document.querySelector<HTMLElement>("#qr-status");
const preview = document.querySelector<HTMLElement>(".qr-preview");
const empty = document.querySelector<HTMLElement>("#qr-empty");
const downloads = document.querySelector<HTMLElement>("#qr-downloads");
const png = document.querySelector<HTMLAnchorElement>("#qr-png");
const svg = document.querySelector<HTMLAnchorElement>("#qr-svg");

if (!tool || !input || !clear || !status || !preview || !empty || !downloads || !png || !svg) {
  throw new Error("QR tool markup is incomplete");
}

const messages = tool.dataset;
const canvas = document.createElement("canvas");
canvas.setAttribute("role", "img");
canvas.setAttribute("aria-label", preview.dataset.previewLabel!);
let svgUrl: string | undefined;

const resetPreview = (): void => {
  canvas.remove();
  downloads.hidden = true;
  png.removeAttribute("href");
  svg.removeAttribute("href");
  empty.hidden = false;
  if (svgUrl) URL.revokeObjectURL(svgUrl);
  svgUrl = undefined;
};

try {
  status.textContent = messages.loadingMessage!;
  const { default: qrcode } = await import("qrcode-generator");
  qrcode.stringToBytes = (text: string) => Array.from(new TextEncoder().encode(text));

  const update = (): void => {
    resetPreview();
    input.removeAttribute("aria-invalid");
    clear.disabled = input.value.length === 0;
    if (!input.value) {
      status.textContent = messages.emptyMessage!;
      return;
    }
    if (new TextEncoder().encode(input.value).length > 2_000) {
      input.setAttribute("aria-invalid", "true");
      status.textContent = messages.tooLongMessage!;
      return;
    }

    try {
      const code = qrcode(0, "M");
      code.addData(input.value, "Byte");
      code.make();
      const modules = code.getModuleCount();
      const border = 4;
      const scale = Math.floor(1_024 / (modules + border * 2));
      canvas.width = canvas.height = (modules + border * 2) * scale;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#000";
      for (let row = 0; row < modules; row++) {
        for (let column = 0; column < modules; column++) {
          if (code.isDark(row, column)) {
            context.fillRect((column + border) * scale, (row + border) * scale, scale, scale);
          }
        }
      }
      const pngUrl = canvas.toDataURL("image/png");
      svgUrl = URL.createObjectURL(
        new Blob([code.createSvgTag({ cellSize: 1, margin: border, scalable: true })], {
          type: "image/svg+xml",
        }),
      );
      png.href = pngUrl;
      png.download = "qr-code.png";
      svg.href = svgUrl;
      svg.download = "qr-code.svg";
      preview.append(canvas);
      empty.hidden = true;
      downloads.hidden = false;
      status.textContent = messages.readyMessage!;
    } catch (error: unknown) {
      resetPreview();
      status.textContent = messages.errorMessage!;
      console.error("QR generation failed", error);
    }
  };

  input.disabled = false;
  input.addEventListener("input", update);
  clear.addEventListener("click", () => {
    input.value = "";
    update();
    input.focus();
  });
  update();
} catch (error: unknown) {
  status.textContent = messages.loadErrorMessage!;
  console.error("QR generator failed to load", error);
}

export {};
