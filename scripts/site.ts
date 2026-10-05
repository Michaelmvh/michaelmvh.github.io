import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const source = path.join(root, "src");
export const output = path.join(root, "dist");

/** Parses external JSON; callers must validate it before use. */
export async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(resolveWithin(source, relativePath), "utf8"));
}

/** Reads an authored, trusted HTML fragment from src/content/. */
export async function readContent(relativePath: string): Promise<string> {
  return fs.readFile(resolveWithin(path.join(source, "content"), relativePath), "utf8");
}

/** Resolves a path while preventing untrusted segments from escaping their expected root. */
export function resolveWithin(base: string, ...segments: string[]): string {
  const target = path.resolve(base, ...segments);
  assert(
    target === base || target.startsWith(`${base}${path.sep}`),
    `Path escapes ${base}: ${segments.join("/")}`,
  );
  return target;
}

/** Escapes structured-data values before inserting them into generated HTML. */
export function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Narrows validated data and throws a precise content error when an invariant fails. */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
