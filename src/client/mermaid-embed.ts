export {};

// Archyne's source and export scrollers need explicit keyboard access in Safari.
function enableKeyboardScrolling(): void {
  for (const element of document.querySelectorAll<HTMLElement>(".cm-scroller, .export-preview")) {
    if (element.tabIndex !== 0) element.tabIndex = 0;
  }
}

new MutationObserver(enableKeyboardScrolling).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["tabindex"],
});
enableKeyboardScrolling();
