# michaelmvh.com

Michael Vanden Heuvel's academic portfolio. The site is generated as plain HTML, CSS, and JavaScript and
deployed to GitHub Pages at <https://michaelmvh.com>.

## Architecture

- `src/content/`: authored HTML fragments and project writeups
- `src/data/`: site configuration and structured project, publication, and baking records
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
`dist/assets/css/site.css`, preserving one browser request without requiring a CSS bundler.

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

Changes to behavior, content structures, rendering, accessibility interactions, or asset processing should add
focused regression coverage when the existing suite would not catch likely failures. Keep tests resilient by
checking data-driven behavior and durable invariants rather than fixed content counts, incidental ordering,
exact pixel geometry, or implementation details; use reasonable ranges for media and layout assertions.

Generated files are written to `dist/` and are not committed.

## Editing content

Site-wide settings and repeated content live in `src/data/`:

- `site.json`: navigation, external links, CV URL, analytics ID, and shared descriptions
- `pages.json`: page titles, metadata descriptions, headings, introductions, and page-specific labels
- `projects.json`: project summaries, categories, tags, images, and external links
- `publications.json`: publication metadata and citations
- `baking.json`: baking cards, images, descriptions, and recipe links
- `other.json`: ordered image-collection sections for the Other page

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

### Add a project

1. Add its card metadata to `src/data/projects.json` with a unique lowercase hyphenated `slug`.
2. Add `src/content/projects/<slug>.html`.
3. Put its image in `src/assets/images/projects/` and use a root-relative path in the JSON.
4. Run `npm run check`.

### Add a publication or bake

Add a record to the corresponding JSON file and put any image or PDF under `src/assets/`. Baking detail pages
are generated from JSON; publications appear on the publication index.

### Add an Other page section or image

The `/other/` page is generated from `src/data/other.json`. Each section has an `id`, title, description, and
ordered image records. Put originals in an organized directory under `src/assets/images/other/`; each image
record requires a stable `id`, root-relative `image` path, and useful `alt` text. A `caption` is optional and
appears only in the lightbox. The build reads intrinsic dimensions directly from each source file.

Add, remove, or reorder section records directly in `other.json`; the renderer, responsive gallery, and
lightbox work for any number of sections without code changes. The build generates responsive WebP variants
for each source image. Replacing an image later requires replacing the source file and updating its path in
`other.json` if the filename changed.

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

Values below `1` for `--gamma` brighten shadows. `--redact` uses output-image coordinates and may be repeated.
The default card is 1600 pixels wide at the standard payment-card aspect ratio with 36 pixels of surrounding
surface retained on every side; change that margin with `--padding`. OpenCV does not reliably read HEIC, so
convert iPhone sources first on macOS with `sips -s format tiff source.heic --out source.tiff`.

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
