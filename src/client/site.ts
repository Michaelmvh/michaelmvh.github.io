const menuButton = document.querySelector<HTMLButtonElement>(".menu-button");
const siteNavigation = document.querySelector<HTMLElement>("#site-navigation");

if (menuButton && siteNavigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    siteNavigation.dataset.open = String(!isOpen);
  });

  siteNavigation.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      menuButton.setAttribute("aria-expanded", "false");
      delete siteNavigation.dataset.open;
    }
  });

  document.documentElement.classList.add("menu-ready");
}

document.querySelector(".filters")?.addEventListener("click", (event) => {
  const button =
    event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-filter]") : null;
  if (!button) return;

  const filter = button.dataset.filter;
  document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((item) => {
    item.setAttribute("aria-pressed", String(item === button));
  });
  document.querySelectorAll<HTMLElement>(".project-card").forEach((card) => {
    card.hidden = filter !== "all" && card.dataset.category !== filter;
  });
});

document.querySelectorAll<HTMLButtonElement>(".citation-button").forEach((button) => {
  const originalLabel = button.textContent;
  const citation = button.dataset.citation;
  if (!citation) throw new Error("Citation button is missing data-citation");
  const { copiedMessage, errorMessage } = button.dataset;
  if (!copiedMessage || !errorMessage) throw new Error("Citation button is missing feedback messages");

  let feedbackTimer: number | undefined;
  let copyAttempt = 0;

  button.addEventListener("click", async () => {
    const currentAttempt = ++copyAttempt;
    window.clearTimeout(feedbackTimer);

    try {
      await navigator.clipboard.writeText(citation);
      if (currentAttempt !== copyAttempt) return;
      button.textContent = copiedMessage;
    } catch {
      if (currentAttempt !== copyAttempt) return;
      button.textContent = errorMessage;
    }

    feedbackTimer = window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1600);
  });
});

const lightbox = document.querySelector<HTMLDialogElement>(".lightbox");
const lightboxMedia = lightbox?.querySelector<HTMLElement>(".lightbox-media");
const lightboxCaption = lightbox?.querySelector<HTMLElement>(".lightbox-caption");
const lightboxClose = lightbox?.querySelector<HTMLButtonElement>(".lightbox-close");
const lightboxStatus = lightbox?.querySelector<HTMLElement>(".lightbox-status");
const lightboxRetry = lightbox?.querySelector<HTMLButtonElement>(".lightbox-retry");
let lightboxImage: HTMLImageElement | null = null;
let lightboxTrigger: HTMLAnchorElement | null = null;
let lightboxAttempt = 0;
let lightboxLoadingTimer: number | undefined;

async function loadLargerImage(): Promise<void> {
  if (!lightbox || !lightboxImage || !lightboxStatus || !lightboxRetry || !lightboxTrigger) return;
  const source = lightboxTrigger.dataset.lightboxSrc;
  const { loadingMessage, errorMessage } = lightbox.dataset;
  if (!source || !loadingMessage || !errorMessage) throw new Error("Lightbox is missing loading data");

  const attempt = ++lightboxAttempt;
  window.clearTimeout(lightboxLoadingTimer);
  lightboxStatus.textContent = "";
  lightboxRetry.hidden = true;
  lightboxLoadingTimer = window.setTimeout(() => {
    if (lightbox.open && attempt === lightboxAttempt) lightboxStatus.textContent = loadingMessage;
  }, 400);

  const image = new Image();
  image.src = source;
  try {
    await image.decode();
  } catch {
    if (!lightbox.open || attempt !== lightboxAttempt) return;
    window.clearTimeout(lightboxLoadingTimer);
    lightboxStatus.textContent = errorMessage;
    lightboxRetry.hidden = false;
    return;
  }
  // A completed request must not replace a different photo or reopen a closed viewer.
  if (!lightbox.open || attempt !== lightboxAttempt) return;
  window.clearTimeout(lightboxLoadingTimer);
  lightboxImage.src = source;
  lightboxStatus.textContent = "";
}

document.querySelector("main")?.addEventListener("click", (event) => {
  const trigger =
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("[data-lightbox-image]") : null;
  if (!trigger || !lightbox || !lightboxMedia || !lightboxCaption) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;

  const source = trigger.dataset.lightboxSrc;
  const alt = trigger.dataset.lightboxAlt;
  const thumbnail = trigger.querySelector("img");
  if (!source || alt === undefined || !thumbnail || !thumbnail.width || !thumbnail.height) {
    throw new Error("Lightbox trigger is missing image data");
  }

  event.preventDefault();
  lightboxTrigger = trigger;
  lightboxImage?.remove();
  lightboxImage = new Image();
  lightboxImage.className = "lightbox-image";
  lightboxImage.src = thumbnail.currentSrc || thumbnail.src;
  lightboxImage.alt = alt;
  const width = Number(thumbnail.getAttribute("width"));
  const height = Number(thumbnail.getAttribute("height"));
  if (!width || !height) throw new Error("Lightbox thumbnail is missing intrinsic dimensions");
  lightboxImage.width = width;
  lightboxImage.height = height;
  lightboxMedia.style.setProperty("--lightbox-width", `${width}px`);
  lightboxMedia.style.setProperty("--lightbox-aspect", String(width / height));
  lightboxMedia.prepend(lightboxImage);

  const caption = trigger.dataset.lightboxCaption;
  lightboxCaption.textContent = caption ?? "";
  lightboxCaption.hidden = !caption;
  lightbox.showModal();
  lightbox.scrollTop = 0;
  void loadLargerImage();
});

lightboxRetry?.addEventListener("click", () => {
  lightboxClose?.focus();
  void loadLargerImage();
});

lightboxClose?.addEventListener("click", () => lightbox?.close());

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

lightbox?.addEventListener("close", () => {
  // A queued close event must not clear an image opened again before that event was delivered.
  if (lightbox.open) return;
  lightboxAttempt++;
  window.clearTimeout(lightboxLoadingTimer);
  lightboxImage?.remove();
  lightboxImage = null;
  if (lightboxStatus) lightboxStatus.textContent = "";
  if (lightboxRetry) lightboxRetry.hidden = true;
  if (lightboxCaption) {
    lightboxCaption.textContent = "";
    lightboxCaption.hidden = true;
  }
  lightboxTrigger?.focus();
  lightboxTrigger = null;
});

const siteThemeKey = "site-theme";
type AlternateTheme = "blueprint" | "scifi";
type SiteTheme = "museum" | AlternateTheme;

const themeTriggers = document.querySelectorAll<HTMLButtonElement>(".theme-trigger[data-site-theme]");
const themeReset = document.querySelector<HTMLButtonElement>("[data-theme-reset]");
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

function applySiteTheme(theme: string | null | undefined): SiteTheme {
  const activeTheme: SiteTheme = isAlternateTheme(theme) ? theme : "museum";

  if (activeTheme === "museum") {
    delete document.documentElement.dataset.siteTheme;
  } else {
    document.documentElement.dataset.siteTheme = activeTheme;
  }

  themeTriggers.forEach((trigger) => {
    trigger.setAttribute("aria-pressed", String(trigger.dataset.siteTheme === activeTheme));
  });

  if (themeReset) {
    const { defaultMessage, returnMessage } = themeReset.dataset;
    if (!defaultMessage || !returnMessage) throw new Error("Theme control is missing accessible labels");
    themeReset.hidden = activeTheme === "museum";
    themeReset.setAttribute(
      "aria-label",
      activeTheme === "museum" ? defaultMessage : returnMessage.replaceAll("{theme}", activeTheme),
    );
  }

  if (themeColor) {
    themeColor.content =
      activeTheme === "blueprint" ? "#087a94" : activeTheme === "scifi" ? "#11183c" : "#f5eee3";
  }

  return activeTheme;
}

function isAlternateTheme(theme: string | null | undefined): theme is AlternateTheme {
  return theme === "blueprint" || theme === "scifi";
}

function saveSiteTheme(theme: SiteTheme): void {
  try {
    if (theme === "museum") {
      localStorage.removeItem(siteThemeKey);
    } else {
      localStorage.setItem(siteThemeKey, theme);
    }
  } catch {}
}

if (!(document.body.dataset.page ?? "").startsWith("style-")) {
  const initialTheme = applySiteTheme(document.documentElement.dataset.siteTheme);

  if (initialTheme !== "museum") saveSiteTheme(initialTheme);

  themeTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const theme = applySiteTheme(trigger.dataset.siteTheme);
      saveSiteTheme(theme);
    });
  });

  themeReset?.addEventListener("click", () => {
    applySiteTheme("museum");
    saveSiteTheme("museum");
  });
}
