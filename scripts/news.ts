import { escapeHtml } from "./site.ts";
import type { NewsEntry } from "./types.ts";

/** Renders validated milestones newest-first without changing their authored order. */
export function renderNews(entries: readonly NewsEntry[], heading: string): string {
  if (entries.length === 0) return "";
  const items = entries
    .toSorted((left, right) => right.date.localeCompare(left.date))
    .map(
      (entry) =>
        `<li id="news-${escapeHtml(entry.id)}"><time datetime="${escapeHtml(entry.date)}">${escapeHtml(
          formatNewsDate(entry.date),
        )}</time><p>${escapeHtml(entry.text)}</p></li>`,
    )
    .join("\n");
  return `<section class="recent-news" aria-labelledby="recent-news-heading">
  <h2 id="recent-news-heading">${escapeHtml(heading)}</h2>
  <ol class="news-list">${items}</ol>
</section>`;
}

function formatNewsDate(date: string): string {
  if (date.length === 4) return date;
  const fullDate = date.length === 7 ? `${date}-01` : date;
  // Noon UTC keeps date-only milestones on the same calendar day in Pacific time.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "short",
    ...(date.length === 10 ? { day: "numeric" } : {}),
  }).format(new Date(`${fullDate}T12:00:00Z`));
}
