import { diffArrays, diffLines } from "diff";
import type { Change } from "diff";
import { checkDocumentLimits, DocumentInputError } from "./document-limits.ts";

export interface DiffPart {
  value: string;
  changed: boolean;
}

export interface ComparedLine extends Change {
  parts: DiffPart[];
}

interface CharacterToken {
  value: string;
  offset: number;
  line: ComparedLine;
}

const characters = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function compareDocuments(
  original: string,
  revised: string,
  ignoreWhitespace = false,
): ComparedLine[] {
  checkDocumentLimits(original);
  checkDocumentLimits(revised);
  const deadline = Date.now() + 200;
  const changes = diffLines(original, revised, {
    stripTrailingCr: true,
    ignoreWhitespace,
    oneChangePerToken: true,
    timeout: 200,
    maxEditLength: 2_000,
  });
  if (!changes) throw new DocumentInputError("comparison");
  const lines: ComparedLine[] = changes.map((change) => ({
    ...change,
    parts: [{ value: change.value, changed: change.added || change.removed }],
  }));
  let block: ComparedLine[] = [];
  for (const line of lines) {
    if (line.added || line.removed) {
      block.push(line);
    } else {
      highlightBlock(block, ignoreWhitespace, deadline);
      block = [];
    }
  }
  highlightBlock(block, ignoreWhitespace, deadline);
  return lines;
}

function tokenize(lines: ComparedLine[], ignoreWhitespace: boolean): CharacterToken[] {
  return lines.flatMap((line, lineIndex) => {
    const start = ignoreWhitespace ? line.value.length - line.value.trimStart().length : 0;
    const end = ignoreWhitespace ? line.value.trimEnd().length : line.value.length;
    return Array.from(characters.segment(line.value))
      .filter(
        ({ segment, index }) =>
          (index >= start && index < end) ||
          (ignoreWhitespace && segment === "\n" && lineIndex < lines.length - 1),
      )
      .map(({ segment, index }) => ({ value: segment, offset: index, line }));
  });
}

function highlightBlock(block: ComparedLine[], ignoreWhitespace: boolean, deadline: number): void {
  const removed = block.filter((line) => line.removed);
  const added = block.filter((line) => line.added);
  if (!removed.length || !added.length) return;

  // Compare the whole replacement block so inserted lines do not misalign subsequent character matches.
  const before = tokenize(removed, ignoreWhitespace);
  const after = tokenize(added, ignoreWhitespace);
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new DocumentInputError("comparison");
  const changes = diffArrays(before, after, {
    comparator: (left, right) => left.value === right.value,
    timeout: remaining,
    maxEditLength: 2_000,
  });
  if (!changes) throw new DocumentInputError("comparison");

  const ranges = new Map<ComparedLine, Array<{ start: number; end: number }>>();
  for (const change of changes) {
    if (!change.added && !change.removed) continue;
    for (const token of change.value) {
      const spans = ranges.get(token.line) ?? [];
      const previous = spans.at(-1);
      const end = token.offset + token.value.length;
      if (previous?.end === token.offset) previous.end = end;
      else spans.push({ start: token.offset, end });
      ranges.set(token.line, spans);
    }
  }
  for (const line of block) {
    line.parts = [];
    let offset = 0;
    for (const span of ranges.get(line) ?? []) {
      if (span.start > offset) {
        line.parts.push({ value: line.value.slice(offset, span.start), changed: false });
      }
      line.parts.push({ value: line.value.slice(span.start, span.end), changed: true });
      offset = span.end;
    }
    if (offset < line.value.length) {
      line.parts.push({ value: line.value.slice(offset), changed: false });
    }
  }
}
