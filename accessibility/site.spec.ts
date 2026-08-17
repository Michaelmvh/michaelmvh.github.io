import fs from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { AxeResults } from "axe-core";
import type { Page } from "@playwright/test";
import type { Bake, Project } from "../scripts/types.ts";

const projects = JSON.parse(await fs.readFile("src/data/projects.json", "utf8")) as Project[];
const baking = JSON.parse(await fs.readFile("src/data/baking.json", "utf8")) as Bake[];
const firstProject = projects[0];
const firstBake = baking[0];
if (!firstProject || !firstBake) throw new Error("Accessibility tests require a project and a bake");

const sharedLayoutRoutes = [
  "/",
  "/publications/",
  "/baking/",
  `/bakes/${firstBake.slug}/`,
  "/projects/",
  `/projects/${firstProject.slug}/`,
  "/accessibility-test-not-found",
];

const referenceRoutes = ["/style-options/", "/style-options/biotech-blueprint/"];
const themes = ["museum", "blueprint", "scifi"];

for (const theme of themes) {
  for (const route of sharedLayoutRoutes) {
    test(`${theme} theme: ${route}`, async ({ page }) => {
      await page.addInitScript((selectedTheme) => {
        if (selectedTheme === "museum") localStorage.removeItem("site-theme");
        else localStorage.setItem("site-theme", selectedTheme);
      }, theme);

      await page.goto(route);
      await openMobileNavigation(page);
      await expectAccessible(page);
    });
  }
}

for (const route of referenceRoutes) {
  test(`reference preview: ${route}`, async ({ page }) => {
    await page.goto(route);
    await openMobileNavigation(page);
    await expectAccessible(page);
  });
}

async function openMobileNavigation(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? 1_000) <= 800) {
    await page.getByRole("button", { name: "Menu" }).click();
  }
}

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

function formatViolations(violations: AxeResults["violations"]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")}: ${node.failureSummary}`)
          .join("\n")}`,
    )
    .join("\n\n");
}
