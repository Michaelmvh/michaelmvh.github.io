# Homepage theme catalog

The public site uses Museum styling by default and supports persistent alternate themes over the same content.
The retained Biotech Blueprint reference preview under `/style-options/` remains private with
`noindex, nofollow` metadata. The obsolete standalone Sci-Fi preview has been removed; its live site-wide
theme remains supported.

## Retained alternatives

- **Biotech Blueprint** — cyan grid-paper structure, cellular schematics, monospace labeling, and precise
  technical hierarchy. This is the retained reference direction for the site-wide biology theme.

## Theme behavior

- Museum remains the default presentation.
- Biotech Blueprint remains implemented and tested but has no live activation control.
- The **science fiction** control in the personal note activates Sci-Fi.
- The selected theme persists across pages and sessions.
- A fixed control returns to the default styling.
- The saved preference is applied before CSS loads to avoid a flash of the default theme.
- Theme controls expose their pressed state and remain keyboard accessible.
