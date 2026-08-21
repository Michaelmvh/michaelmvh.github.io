# Repository working agreement

These instructions apply to human contributors and automated coding agents, regardless of the tools or
platform used.

## Repository purpose

This repository builds Michael Vanden Heuvel's academic portfolio for GitHub Pages. Source code and tests use
strict TypeScript, but the deployed artifact remains a framework-free static site made of HTML, CSS, and
JavaScript. Do not introduce Jekyll, React, or another runtime framework unless the site's requirements change
enough to justify the added complexity.

## Sources of truth

- Put page titles, metadata, labels, and short introductions in `src/data/pages.json`.
- Put navigation, shared settings, and collection records in the corresponding files under `src/data/`.
- Put trusted long-form prose in `src/content/`; project fragment filenames must match their data slugs.
- Put browser behavior in `src/client/`, rendering and build behavior in `scripts/`, and ordered CSS partials
  in `src/styles/`.
- Treat `dist/` as generated output. Do not edit or commit it.
- Keep authored copy out of generator functions. Rendering code should provide structure and reusable
  behavior, not act as a second content store.

## Implementation constraints

- Keep essential content and navigation available in generated HTML; browser JavaScript is progressive
  enhancement only.
- Preserve strict typing and runtime validation for JSON, which remains untrusted external input at runtime.
- Reuse the existing static generator and helpers before adding dependencies or parallel implementations.
- Preserve responsive behavior, keyboard support, semantic HTML, and all current axe coverage. Do not suppress
  accessibility rules or page regions to make tests pass.
- Keep project images within the enforced 1 MiB budget and provide accurate intrinsic dimensions and alt text.
- Preserve local-preview analytics protections and the custom-domain deployment files.

## Validation

Use Node.js 24 or newer. Before considering a change complete, run the smallest relevant checks and then the
full required checks for code or configuration changes:

```sh
npm run format:check
npm run check
```

`npm run check` type-checks the TypeScript, validates content, builds the site, validates generated HTML, runs
regression tests, and runs Playwright/axe accessibility tests.

When behavior, content structures, rendering, accessibility interactions, or asset processing changes, assess
whether the existing suite would catch likely regressions and add focused tests when it would not. Prefer
data-driven behavior and durable invariants over fixed item counts, incidental ordering, exact pixel geometry,
or implementation details. Use reasonable ranges or tolerances for media and layout checks so normal content
updates do not require unrelated test rewrites.

For changes expected to affect loading performance, asset delivery, render timing, or analytics, also consider
running mobile and desktop Lighthouse assessments against the deployed site after the production deployment
finishes. Compare the relevant audits as well as category scores because Lighthouse scores vary between runs.
Use Lighthouse as a diagnostic rather than a deterministic CI gate.

## Documentation maintenance

Treat `README.md` as part of the implementation. Update it in the same change whenever commands,
prerequisites, source locations, architecture, content-editing steps, validation, CI, deployment, or supported
behavior changes. Keep this file focused on durable repository conventions and platform-neutral guidance.
