import assert from "node:assert/strict";
import test from "node:test";
import { loadSiteData } from "../scripts/data.ts";
import { validateSiteData } from "../scripts/validation.ts";

test("validation accepts unknown input only after checking the complete site shape", async () => {
  for (const input of [null, [], false, "site", {}, { site: null }]) {
    assert.throws(() => validateSiteData(input));
  }
  const input: unknown = await loadSiteData();
  validateSiteData(input);
  assert.ok(input.site.name);
  assert.ok(Array.isArray(input.projects));
});

test("every page-copy field is checked, including nested browser contracts", async () => {
  const data = await loadSiteData();
  const optional = new Set([
    "home.description",
    "home.introduction",
    "publications.introduction",
    "baking.introduction",
    "other.introduction",
  ]);
  function checkFields(record: object, prefix: string): void {
    for (const [key, value] of Object.entries(record)) {
      const location = `${prefix}.${key}`;
      if (typeof value === "object" && value !== null) {
        checkFields(value, location);
        continue;
      }
      assert.equal(typeof value, "string", location);
      for (const invalid of [undefined, null, 42, [], {}]) {
        Object.assign(record, { [key]: invalid });
        assert.throws(() => validateSiteData(data), Error, location);
      }
      Object.assign(record, { [key]: "" });
      if (optional.has(location)) assert.doesNotThrow(() => validateSiteData(data), location);
      else assert.throws(() => validateSiteData(data), Error, location);
      Object.assign(record, { [key]: value });
    }
  }
  for (const [page, copy] of Object.entries(data.pages)) {
    if (page !== "_instructions") checkFields(copy, page);
  }
  validateSiteData(data);
});

test("site identity arrays reject missing, empty, and non-string values", async () => {
  for (const field of ["wordmark", "knowsAbout"] as const) {
    for (const invalid of [undefined, "", [], [""], [1]]) {
      const data = await loadSiteData();
      Object.assign(data.site, { [field]: invalid });
      assert.throws(() => validateSiteData(data), new RegExp(field));
    }
  }
});

test("the loader returns independent data for callers and malformed-input tests", async () => {
  const first = await loadSiteData();
  first.pages.shared.menuLabel = "Changed in one caller";
  const second = await loadSiteData();
  assert.notEqual(first.pages.shared.menuLabel, second.pages.shared.menuLabel);
});
