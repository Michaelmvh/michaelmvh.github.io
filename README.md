# michaelmvh.com

Michael Vanden Heuvel's academic portfolio. The site is generated as plain HTML, CSS, and JavaScript and
deployed to GitHub Pages at <https://michaelmvh.com>.

## Architecture

- `src/content/`: authored HTML fragments and project writeups
- `src/data/`: site configuration and structured news, project, publication, and baking records
- `src/assets/`: images and documents copied directly into the build
- `src/client/`: browser TypeScript compiled to JavaScript during the build
- `src/styles/`: ordered CSS partials for tokens, shared styles, pages, themes, and private previews
- `scripts/`: content validation, static generation, local serving, and CV synchronization
- `accessibility/`: Playwright and axe browser accessibility tests
- `test/`: generated-site regression tests
- `dist/`: generated deployment artifact; ignored by Git

The small Node.js generator is written in strict TypeScript and renders complete semantic HTML. Browser
TypeScript is compiled to plain JavaScript and provides progressive enhancements such as the mobile menu; it
does not supply essential page content. The generator concatenates the ordered files in `src/styles/` into one
`dist/assets/css/site.css`, preserving one browser request without requiring a CSS bundler. The document tools
additionally use esbuild to bundle their browser-only npm dependencies into local ES modules. Code splitting
loads the JSON parser only on the JSON page. Browser source imports may use `.ts` extensions; the client
compiler rewrites them to `.js`.

Platform-neutral contributor and automation guidance lives in [`AGENTS.md`](AGENTS.md). Keep this README
updated in the same change whenever the architecture, commands, prerequisites, editing workflow, validation,
CI, or deployment process changes.

## Local development

Use Node.js 24 LTS or newer.

```sh
npm ci
npm run dev
```

The preview is available at <http://localhost:8080>. `npm run dev` builds once before starting the server; it
watches files under `src/`, rebuilds after changes, and automatically refreshes connected browser tabs. Build
errors are reported in the terminal, and the preview rebuilds again after the next source edit.

Run all local checks with:

```sh
npm run check
npm run format:check
```

`npm run check` includes browser-based axe accessibility scans at desktop and mobile sizes for the default,
Blueprint, and Sci-Fi themes, as well as strict TypeScript checking for the generator, browser code, and
tests. Run only the accessibility scans with `npm run a11y`, or only the compiler with `npm run typecheck`.
Install the pinned Chromium build once on a new machine with `npx playwright install chromium`.

Browser regression coverage also exercises image loading and lightbox scrolling at narrow portrait, landscape,
tablet, breakpoint-adjacent, desktop, and wide-screen sizes. Image cases are derived from the project and
baking collections so newly added records receive the same coverage.

Changes to behavior, content structures, rendering, accessibility interactions, or asset processing should add
focused regression coverage when the existing suite would not catch likely failures. Keep tests resilient by
checking data-driven behavior and durable invariants rather than fixed content counts, incidental ordering,
exact pixel geometry, or implementation details; use reasonable ranges for media and layout assertions.

Generated files are written to `dist/` and are not committed.

### iOS bookmarks and Safari

The build renders the font-independent SVG artwork in `src/assets/images/site-touch-icon.svg` and
`tools-touch-icon.svg` into opaque 180x180 PNGs. Public pages declare `/apple-touch-icon.png` (the MVH
monogram); the tools directory and every tool declare `/tools/apple-touch-icon.png` (a dark wrench pointing
upper-right on the homepage's off-white background). The existing scientist SVG favicon remains unchanged.
These are bookmark/Home Screen icons, not a PWA or an offline cache. iOS may cache an existing bookmark's icon
until the bookmark is recreated.

The keyboard skip link is clipped in place until focused rather than translated above the viewport. This
avoids placing a dark fixed layer behind iPhone Safari's translucent status bar when scrolling, including when
the device is in dark mode but the site uses its default light theme.

## Editing content

Site-wide settings and repeated content live in `src/data/`:

- `site.json`: navigation, external links, CV URL, analytics ID, and shared descriptions
- `pages.json`: page titles, metadata descriptions, headings, introductions, and page-specific labels
- `projects.json`: project summaries, categories, tags, images, and external links
- `publications.json`: publication metadata and citations
- `news.json`: dated, one-line achievements for the homepage Recent News section
- `baking.json`: baking cards, images, descriptions, and recipe links
- `other.json`: ordered image-collection sections for the Other page
- `tools.json`: ordered tool-directory cards and slugs for unlisted utility pages

Long-form content lives in `src/content/`. Home is an HTML fragment. Each project has an HTML fragment under
`src/content/projects/` whose filename matches its `slug` in `projects.json`.

As an editing rule, authored wording belongs in `src/content/` or `src/data/`, not in `scripts/build.ts`.
Generator functions should contain only reusable markup and rendering behavior. Shared data interfaces live in
`scripts/types.ts`; runtime validation still checks the external JSON content before rendering.

`pages.json` begins with an `_instructions` reference explaining every supported field. Optional introduction
fields for Home, Publications, and Baking are included as empty strings; populate one and the build renders it
in the corresponding page without requiring a TypeScript change.

`src/content/research.html` is intentionally dormant: the build does not publish it, link to it, or add it to
the sitemap. To publish it later, restore its page definition in `scripts/build.ts`, add its navigation record
to `src/data/site.json`, and then add only the homepage links that fit the finished content.

Projects are published in the main navigation and sitemap. The project index is generated from
`src/data/projects.json`, while each detail page combines that metadata with its matching HTML fragment.

The public site uses Museum styling by default. An inline homepage control activates a persistent Sci-Fi theme
over the same content, with a visible return-to-default control. Its obsolete standalone preview has been
removed. The Biotech Blueprint implementation is retained but has no live activation control; its more
elaborate reference page under `/style-options/` remains available for private review with
`noindex, nofollow`. Implementation details are documented in `src/content/style-options/README.md`.

All required JSON fields are checked by `npm run validate`. Text from JSON is escaped during rendering;
trusted authored markup belongs in an HTML fragment.

### Unlisted tools

`/tools/` is a directory generated from the ordered registry in `src/data/tools.json`. Each card links to a
separate, bookmarkable page with an "All tools" link back to the directory. Navigation works without
JavaScript.

`/tools/qr-code/` contains a browser-only QR code generator with a live canvas preview and PNG/SVG downloads.
It preserves input exactly (including Unicode, spaces, and line breaks), accepts up to 2,000 UTF-8 bytes, and
uses medium error correction with a four-module white border. Input is not uploaded or persisted, and
analytics are omitted from this page.

`/tools/json/` formats or minifies the Original JSON input and compares it with Revised JSON. Comparison
normalizes indentation and string escaping; optional key sorting also ignores object-property order. Arrays
retain their order and numeric tokens retain their exact spelling and precision, so `1` and `1.0` still
compare differently. The parser rejects comments, trailing commas, and duplicate keys and reports syntax
locations. Output can be copied or downloaded without modifying the original input.

`/tools/text-diff/` compares snippets with inline character-level highlights within added and removed lines.
Empty inputs are valid. Windows/Unix line endings compare equally; final-newline differences are marked. An
option ignores leading/trailing whitespace, including the final newline, but not internal word spacing. When
ignored whitespace differs, unchanged lines display the revised text.

Both document tools keep content in page memory only and compare automatically 200 ms after the last input or
option change, pausing during IME composition. The previous diff stays visible with an updating status until
the new result is ready; invalid or incomplete JSON clears it. JSON comparison waits for both inputs, while
text comparison supports an empty side. Clearing cancels pending work. Formatting remains an explicit action,
and editing Revised JSON does not invalidate formatted output from Original JSON.

Both tools use line alignment for context, then compare characters across each replacement block. Matching
text stays unhighlighted; precise insertions and deletions use stronger backgrounds and semantic `ins`/`del`
markup. Unicode grapheme clusters keep emoji and combining characters intact. Summaries remain line-based, and
final-newline differences retain their explicit markers.

Inputs and formatted JSON output are limited to 100,000 UTF-16 code units and 2,000 lines. JSON nesting is
capped at 100 levels. Line and character matching share a 200 ms diff budget, with a 2,000-line edit-distance
limit and a 2,000-grapheme edit-distance limit per replacement block. Exceeding these limits shows visible
feedback rather than blocking or silently reverting to whole-line highlighting.

The directory and all tool pages are excluded from main navigation and the sitemap and include
`noindex, nofollow`. They remain publicly accessible by URL: this is discovery control, not authentication.
Crawling is allowed so search engines can read the noindex directive.

Page copy lives in `src/data/pages.json`; shared document labels are under `tools.documentEditor`. Markup
lives in `scripts/tools.ts` and `scripts/document-tools.ts`, browser behavior in `src/client/qr-code.ts` and
the `src/client/document-*.ts` / `json-format.ts` modules, and styling in `src/styles/tools.css` and
`src/styles/document-tools.css`. The shared browser/server document-copy interface lives in
`scripts/document-copy.d.ts`. The build copies the pinned `qrcode-generator` ES module, preserving its license
header, into local assets; a page-scoped import map loads it without a CDN or runtime framework. Other pages
do not load the QR module. Browser regressions decode downloaded images with `jsqr` to verify their contents.
Document comparisons use `diff`; strict JSON parsing uses `jsonc-parser` without converting number tokens back
through JavaScript numbers. Their license files are copied to the local vendor assets. No tool needs a
backend, CDN, or external API.

`/tools/mermaid/` embeds the pinned `archyne@1.0.0-alpha.1` static application, providing visual diagram
creation, drag-to-connect, automatic layout, editable Mermaid source, undo/redo, file open/save, and image
exports. Archyne supports visual editing for several diagram families; other supported Mermaid diagrams remain
text-editable with a preview. This is an alpha editor: keep original imported files, since visual edits can
normalize syntax. Mermaid versions and layout may differ in Obsidian.

Archyne is a build-only dependency. `scripts/mermaid.ts` copies its already-built assets unchanged to
`dist/tools/mermaid/editor/` and generates a small standalone shell with local-only network policy, noindex,
and no analytics. The upstream demo page and social metadata are not shipped. Its React runtime and styles
stay inside the iframe and are never loaded by the portfolio or other tools. The package's MIT license, NOTICE
(including separate icon terms), and third-party notices are preserved alongside the editor. The shell blocks
external icon/image requests; bundled icons and local files remain usable. The iframe allows scripts,
same-origin assets, and downloads, but not popups or top-level navigation.

`src/client/mermaid-tool.ts` starts Archyne in embed mode with the exact host origin, validates the source and
origin of editor messages, and provides full-screen expansion where supported. A compact header, collapsed
instructions, and a nearly full-width workspace prioritize editing space without changing other pages.
Expanding instructions or entering full screen keeps the existing editor instance. Page labels and guidance
live in `pages.json`; upstream editor labels remain upstream-owned. Local live reload is injected only into
the outer page, not the CSP-restricted shell.

Archyne itself does not persist diagrams in embed mode. The host's `src/client/mermaid-recovery.ts` adds
opt-in recovery through its existing `getCode`, `change`, and `load` messages. It stores one raw Mermaid
draft, including incomplete syntax and layout comments, under `mermaid-recovery-v1` in localStorage. Updates
arrive about 300 ms after edits. On returning, explicitly restore or forget the draft; startup examples never
overwrite it. Restoring enables continued recovery, while disabling recovery or choosing Forget draft deletes
the stored copy without clearing the canvas. A change from another tab pauses saving here and offers that
draft for restoration instead.

Recovery is limited to 500,000 UTF-16 code units and the current diagram, not Archyne's entire multi-document
workspace. Storage failures or oversized input pause recovery with visible feedback, retaining any previous
saved copy. Browser storage can be cleared or unavailable, and recent edits may not yet have reached the host
when a tab closes. Use Save .mmd for durable files and Open to resume; recovery is not a substitute for
saving. No diagrams are uploaded and recovery is off until explicitly enabled.

To update Archyne, deliberately change its exact package version and lockfile, then run all checks. The build
rejects unrecognized entry-point markup instead of guessing at a changed package layout. Recheck visual/source
round trips, file downloads/reopening, local-only requests, embed persistence, and desktop and mobile
accessibility against the actual packaged build before accepting an update. No separate fork or editor
repository is required for this integration.

The small `src/client/mermaid-embed.ts` adapter makes the source and export preview scrollers keyboard
focusable, including in Safari, without modifying upstream bundles. Keep its selectors covered when upgrading
Archyne; no accessibility rules are excluded for the embedded application.

To add a utility, add its unique lowercase hyphenated `slug`, card `name`, and `description` to `tools.json`;
add its page copy to `pages.json` with corresponding types and validation; and register its renderer and
page-specific scripts in `toolDefinitions` in `scripts/build.ts`. The build derives `/tools/<slug>/` routes,
applies noindex and disables analytics for every tool, and rejects registry entries without an implementation.

`/tools/url-inspector/` breaks down absolute HTTP(S) URLs and exposes ordered, decoded query parameters. It
never navigates to or requests the URL. Editing names/values or adding entries updates a separate output;
duplicate names, blank names, and multiline decoded values are supported. Original input is not overwritten.
Untouched query segments are taken directly from the trimmed input, preserving literal characters (including
apostrophes), raw encoding, ordering, bare flags, and separators. Changed entries use `encodeURIComponent` and
`name=value` syntax. Browser URL normalization still applies to the host/path; outer whitespace is trimmed,
malformed query encoding is rejected, and credentials are retained with a visible warning. URL edits can
invalidate signatures.

Tracking detection recognizes `utm_*`, `gclid`, `dclid`, `fbclid`, `msclkid`, `mc_cid`, `mc_eid`, `igshid`,
`_ga`, `_gl`, `yclid`, and `ttclid`, case-insensitively. Selection is explicit and removal is a separate
action; generic keys such as `ref` and `source` are not automatically treated as trackers. Removing every
parameter also removes the query delimiter, preserving the fragment. Inputs and encoded outputs are limited to
16,384 UTF-16 code units and 200 parameters.

`/tools/text-utilities/` applies live, composable transformations in this order: Unicode case conversion,
per-line trimming, removal of whitespace-only lines, case-sensitive deduplication, then ascending/descending
Unicode code-unit sorting (not locale-aware or numeric sorting). Deduplication keeps the first occurrence.
Line endings normalize to LF; a final newline is retained unless no lines remain. Input remains unchanged.
Case options include lowercase, uppercase, and Capitalize Each Word, which uppercases each word's first letter
and lowercases the remainder using Unicode word boundaries, preserving punctuation and spacing. Counts report
Unicode graphemes, word-like segments from `Intl.Segmenter`, and logical lines; a terminal newline does not
add an extra counted line. Input and output share the document tools' 100,000-code-unit and
2,000-newline-separated-line limits, including case conversions that expand output.

Text transformations update after a 200 ms pause, wait for IME composition to finish, and disable exports
while pending. Clear cancels pending work but preserves chosen options. Both utilities provide plain-text
downloads and clipboard copying with manual-copy guidance on failure. They keep data only in page memory.
Their page-scoped modules share `src/client/utility-common.ts` for output/clipboard handling; pure logic lives
in `url-inspector-model.ts` and `text-utilities-model.ts`. Markup is in `scripts/utility-tools.ts`, copy
contracts in `scripts/utility-copy.d.ts`, and labels in `pages.json`. No additional dependencies are needed.

### Add a news entry

Add a record to `src/data/news.json` with a unique lowercase hyphenated `id`, a `date`, and plain-text `text`.
Dates support `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`; use only the precision you know rather than inventing a
month or day. For example:

```json
{
  "id": "example-achievement",
  "date": "2026-09",
  "text": "A short sentence describing the achievement."
}
```

The homepage renders all entries newest-first beneath the introduction, with authored order preserved for
identical dates. Entries with more precise dates sort before year-only or month-only entries in the same
period. Dates display as a year, month and year, or full date without shifting calendar days. Text is escaped,
and long entries wrap on smaller screens. Edit the heading in `pages.json` (`home.newsHeading`). An empty
`news.json` array hides the section. News is included in the generated HTML and does not require JavaScript.

### Add a project

1. Add its card metadata to `src/data/projects.json` with a unique lowercase hyphenated `slug`.
2. Add `src/content/projects/<slug>.html`.
3. Put its image in `src/assets/images/projects/` and use a root-relative path in the JSON.
4. Run `npm run check`.

Projects may include an optional ordered `screenshots` array in `projects.json`. Each screenshot requires a
unique `id` within the project, a root-relative `image` path, accurate intrinsic `width` and `height`, useful
`alt` text, and a visible `caption`. The detail page renders these figures after the project narrative; the
section heading comes from `pages.json` (`projects.screenshotsLabel`). Portrait screenshots retain their
proportions at a restrained width.

For projects with screenshots, the build generates responsive WebP variants for both the main project image
and the screenshot collection. Detail-page images reuse the Other page's keyboard-accessible lightbox; their
links open the full-resolution asset when JavaScript is unavailable. Project images without screenshots keep
their existing rendering behavior.

Prepare publication-ready images before adding them to `src/assets/images/projects/`: crop unrelated portal
UI, remove private account or environment details, and confirm that the material can be shared publicly. Use
descriptive filenames, preserve legible text, and keep every source image within the 1 MiB budget. Only these
prepared sources belong in the repository; responsive variants are generated in `dist/`. Keep original
captures and recordings outside the repository.

### Add a publication or bake

Add a record to the corresponding JSON file and put any image or PDF under `src/assets/`. Baking detail pages
are generated from JSON; publications appear on the publication index. Baking image dimensions are read at
build time with EXIF orientation applied, so no dimensions need to be entered in `baking.json`. Cards load
images lazily; detail headers load eagerly. The build copies these images unchanged, without enlarging or
re-encoding them. Keep baking sources within 400 KiB and 1600 pixels on their longest edge.

### Add an Other page section or image

The `/other/` page is generated from `src/data/other.json`. Each section has an `id`, title, description, and
ordered image records. Put originals in an organized directory under `src/assets/images/other/`; each image
record requires a stable `id`, root-relative `image` path, and useful `alt` text. A `caption` is optional and
appears only in the lightbox. The build reads intrinsic dimensions directly from each source file.

Add, remove, or reorder section records directly in `other.json`; the renderer, responsive gallery, and
lightbox work for any number of sections without code changes. The build generates responsive WebP variants
for each source image. Replacing an image later requires replacing the source file and updating its path in
`other.json` if the filename changed.

The shared lightbox keeps its close control outside the image area and scrolls vertically when an image and
caption exceed the available viewport height. Keyboard, touch, and wheel scrolling can reach long captions
without scrolling the background page; closing restores focus to the image link. It immediately previews the
selected gallery thumbnail at the photo's reserved aspect ratio, then replaces it only after the larger image
has loaded and decoded. Slow loads show a delayed status; failures retain the preview and offer a retry.
Shared viewer labels and messages live under `lightbox` in `pages.json`.

#### Prepare a photographed transit card

The optional `scripts/process-card-image.py` utility perspective-corrects a photographed card, normalizes
lighting, exports WebP, and can replace serial-number regions with nearby card texture before publication.
Install its image-processing dependency outside the project:

```sh
python -m pip install opencv-python
```

For a well-lit card with visible edges, let the utility detect its boundary:

```sh
python scripts/process-card-image.py source.jpg src/assets/images/other/orca-cards/new-card.webp \
  --auto \
  --gamma 0.9 \
  --redact "100,820,470,915"
```

Automatic detection scores candidate quadrilaterals using card aspect ratio, rectangularity, area, and visible
edge support. It exits without creating an image when confidence is too low. For a dark card on a dark
surface, glare, or a partially hidden edge, open the source in an image editor and provide the four corners
clockwise from the top left with `--corners "410,520 3600,540 3650,2540 390,2520"` instead.

Values below `1` for `--gamma` brighten shadows. `--redact` uses final output-image coordinates, measured from
the top-left of the entire image including its padding, and may be repeated. Rectangles blend nearby card
texture over the selected area rather than using an opaque block. Choose a region with a margin around the
text and inspect the exported image before publication to confirm the blending removed all sensitive details.
The default card is 1600 pixels wide at the standard payment-card aspect ratio with 36 pixels of surrounding
surface retained on every side; change that margin with `--padding`. OpenCV does not reliably read HEIC, so
convert iPhone sources first on macOS with `sips -s format tiff source.heic --out source.tiff`.

After installing the optional OpenCV dependency, run the utility's synthetic-image regression tests with
`python -m unittest discover -s test -p '*_test.py'`. An optional `image-utility` job is commented out in
`.github/workflows/ci.yml`; uncomment it when automated coverage of utility changes is needed. Python is not
required for normal CI, the site's Node.js build, or `npm run check`.

Images retain their natural aspect ratio. The build detects intrinsic dimensions from each source image so the
browser can reserve space without cropping or layout shift; dimensions do not need to be recorded in
`other.json`.

The homepage portrait keeps `profile.jpg` as its compatibility fallback and serves generated 400px and 800px
WebP variants through responsive image markup. `scripts/images.ts` defines responsive-image specifications;
the build uses Sharp to generate derivatives in `dist/`, so only original images belong in `src/assets/`.
Regression tests verify generated formats, dimensions, and conservative file-size budgets.

### Add a top-level page

Add an HTML fragment under `src/content/`, add the page definition in `scripts/build.ts`, and add its
navigation record to `src/data/site.json` if it belongs in the main navigation.

## CV

The CV points to:

```text
/assets/documents/CV.pdf
```

The private `Michaelmvh/cv-source` repository stores the LaTeX source and builds the public CV. Its reviewed
publish workflow copies `cv-public.pdf` to `CV.pdf` on the `main` branch of the public `Michaelmvh/CV`
repository. That public repository creates a versioned GitHub release whenever `CV.pdf` changes.

Run `npm run sync:cv` to download the current public `CV.pdf` into this repository. Every portfolio deployment
runs this sync before building, so the deployed PDF is served from `michaelmvh.com` and opens in the browser's
native PDF viewer. The public CV publishing workflow sends a `cv-published` repository dispatch after creating
its release, which triggers this repository's deployment workflow and refreshes the hosted copy. This requires
the public CV repository's `PORTFOLIO_DISPATCH_TOKEN` Actions secret; without it, the release still succeeds
and the hosted copy refreshes on the next portfolio deployment.

### Configure automatic CV deployments

The dispatch token must be created and stored manually because GitHub does not allow a workflow to create its
own credentials:

1. Open GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Select **Generate new token**.
3. Enter a descriptive name such as `CV portfolio deployment` and choose an expiration period.
4. Set **Resource owner** to `Michaelmvh`.
5. Under **Repository access**, choose **Only select repositories** and select
   `Michaelmvh/michaelmvh.github.io`.
6. Under **Repository permissions**, set **Contents** to **Read and write**. GitHub requires this permission
   to create a repository dispatch event; the workflow does not modify the portfolio's source files.
7. Generate the token and copy it immediately. GitHub will not display it again.
8. Open the `Michaelmvh/CV` repository and navigate to **Settings → Secrets and variables → Actions → New
   repository secret**.
9. Name the secret `PORTFOLIO_DISPATCH_TOKEN`, paste the token as its value, and save it.

No additional workflow changes are required. The next successful CV publication will dispatch `cv-published`,
causing this repository to download the latest PDF and deploy the site. When the fine-grained token expires,
generate a replacement with the same repository access and permission, then update the existing
`PORTFOLIO_DISPATCH_TOKEN` secret in `Michaelmvh/CV`.

## Deployment

Pull requests and branch pushes run formatting, content validation, build, generated-page tests, and
browser-based axe accessibility scans. Merges to `main` repeat those checks before publishing `dist/` through
GitHub's official Pages actions, so accessibility violations block production deployment. The deployment
artifact includes `CNAME`, preserving `michaelmvh.com`.

GitHub Pages is configured to use **GitHub Actions**, not a deployment branch. Production deploys can be
monitored in the repository's **Actions** tab under **Deploy to GitHub Pages**.

To roll back, revert the production commit on `main` or rerun the deployment for a known-good commit. The
pre-migration history, including the previous Jekyll site, is preserved in the private
`Michaelmvh/michaelmvh.github.io-history` archive repository rather than this repository's streamlined
history.

## Analytics and metadata

The Google Analytics measurement ID is configured in `src/data/site.json`. Analytics loads on deployed pages
with IP anonymization enabled. Page titles, descriptions, canonical URLs, Open Graph metadata, structured
data, `sitemap.xml`, and `robots.txt` are generated by `scripts/build.ts`; the social sharing image is
`src/assets/images/social-preview.jpg`.

## License

The site source code is available under the MIT License. Unless otherwise indicated, personal writing, the CV,
photographs, images, and other media are copyright Michael Vanden Heuvel and are not covered by the MIT
License. See `LICENSE` for details.
