import { checkDocumentLimits } from "./document-limits.ts";

export interface TextOptions {
  letterCase: "unchanged" | "lower" | "upper" | "capitalize";
  trimLines: boolean;
  removeBlank: boolean;
  deduplicate: boolean;
  sort: "none" | "ascending" | "descending";
}

const characters = new Intl.Segmenter("en", { granularity: "grapheme" });
const words = new Intl.Segmenter("en", { granularity: "word" });

function capitalizeWords(text: string): string {
  return Array.from(words.segment(text), ({ segment, isWordLike }) =>
    isWordLike ? segment.toLowerCase().replace(/\p{L}/u, (letter) => letter.toUpperCase()) : segment,
  ).join("");
}

export function transformText(input: string, options: TextOptions): string {
  checkDocumentLimits(input);
  if (!input) return "";
  const normalized = input.replace(/\r\n?/g, "\n");
  const finalNewline = normalized.endsWith("\n");
  let lines = normalized.split("\n");
  if (finalNewline) lines.pop();
  if (options.letterCase === "lower") lines = lines.map((line) => line.toLowerCase());
  if (options.letterCase === "upper") lines = lines.map((line) => line.toUpperCase());
  if (options.letterCase === "capitalize") lines = lines.map(capitalizeWords);
  if (options.trimLines) lines = lines.map((line) => line.trim());
  if (options.removeBlank) lines = lines.filter((line) => line.trim().length > 0);
  if (options.deduplicate) lines = [...new Set(lines)];
  if (options.sort !== "none") {
    const direction = options.sort === "ascending" ? 1 : -1;
    lines.sort((a, b) => (a < b ? -direction : a > b ? direction : 0));
  }
  const output = lines.join("\n") + (lines.length && finalNewline ? "\n" : "");
  checkDocumentLimits(output);
  return output;
}

export function countText(input: string): { characters: number; words: number; lines: number } {
  checkDocumentLimits(input);
  const normalized = input.replace(/\r\n?/g, "\n");
  let characterCount = 0;
  let wordCount = 0;
  for (const _ of characters.segment(normalized)) characterCount++;
  for (const word of words.segment(normalized)) if (word.isWordLike) wordCount++;
  return {
    characters: characterCount,
    words: wordCount,
    lines: normalized ? normalized.split("\n").length - Number(normalized.endsWith("\n")) : 0,
  };
}
