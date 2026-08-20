export const liveReloadPath = "/__live-reload";

const liveReloadScript = `<script>
  new EventSource("${liveReloadPath}").addEventListener("reload", () => location.reload());
</script>`;

/** Adds the local reload client without changing generated production HTML. */
export function injectLiveReload(html: string): string {
  return html.replace("</body>", `${liveReloadScript}\n  </body>`);
}
