const menuButton = document.querySelector<HTMLButtonElement>(".menu-button");
const siteNavigation = document.querySelector<HTMLElement>("#site-navigation");

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  if (siteNavigation) siteNavigation.dataset.open = String(!isOpen);
});

siteNavigation?.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("a")) {
    menuButton?.setAttribute("aria-expanded", "false");
    delete siteNavigation.dataset.open;
  }
});

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

  let feedbackTimer: number | undefined;
  let copyAttempt = 0;

  button.addEventListener("click", async () => {
    const currentAttempt = ++copyAttempt;
    window.clearTimeout(feedbackTimer);

    try {
      await navigator.clipboard.writeText(citation);
      if (currentAttempt !== copyAttempt) return;
      button.textContent = "Copied";
    } catch {
      if (currentAttempt !== copyAttempt) return;
      button.textContent = "Copy failed";
    }

    feedbackTimer = window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1600);
  });
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
    themeReset.hidden = activeTheme === "museum";
    themeReset.setAttribute(
      "aria-label",
      activeTheme === "museum" ? "Default theme active" : `Return from ${activeTheme} to the default theme`,
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
