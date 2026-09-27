import assert from "node:assert/strict";
import test from "node:test";
import { compareDocuments } from "../src/client/document-diff.ts";
import {
  checkDocumentLimits,
  DocumentInputError,
  maximumCharacters,
  maximumLines,
  maximumJsonDepth,
} from "../src/client/document-limits.ts";
import { formatJson } from "../src/client/json-format.ts";

const inputError =
  (kind: DocumentInputError["kind"]) =>
  (error: unknown): boolean =>
    error instanceof DocumentInputError && error.kind === kind;

test("JSON formatting preserves precise numbers, primitive roots, and property names", () => {
  for (const value of [
    "90071992547409931234567890",
    "1.234567890123456789",
    "1e400",
    "-0",
    "true",
    "false",
    "null",
    '""',
    '"hello\\nworld"',
    "{}",
    "[]",
  ]) {
    assert.equal(formatJson(` \n ${value} \t`, true), value);
  }
  const source = '{"__proto__":{"safe":true},"10":1,"2":2,"a":[null,false,9007199254740993]}';
  assert.equal(formatJson(source, true), source);
  assert.equal(
    formatJson('{"b":{"d":1,"c":2},"a":[{"b":1,"a":2},0]}', true, true),
    '{"a":[{"a":2,"b":1},0],"b":{"c":2,"d":1}}',
  );
  assert.equal(formatJson('{"a":1}'), '{\n  "a": 1\n}');
  assert.equal(formatJson('{"10":1,"2":2,"":3}', true, true), '{"":3,"10":1,"2":2}');
  assert.equal(formatJson('"\\u0061"', true), '"a"');
});

test("invalid JSON and duplicate keys fail rather than silently changing input", () => {
  for (const source of [
    "",
    "   ",
    '{"a":}',
    '{"a":1,}',
    "[1,]",
    '{"a":1}// comment',
    "undefined",
    "NaN",
    "Infinity",
    "01",
    "1.",
    "1e",
    '{"a":1}{"b":2}',
    '"unterminated',
  ]) {
    assert.throws(() => formatJson(source), inputError("syntax"), source);
  }
  for (const source of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"nested":{"x":0,"x":1}}']) {
    assert.throws(() => formatJson(source), inputError("duplicate"));
  }
  try {
    formatJson('{\n "a":\n}');
    assert.fail("Expected syntax error");
  } catch (error: unknown) {
    assert.ok(error instanceof DocumentInputError);
    assert.equal(error.offset, 8);
    assert.equal(error.reason, "ValueExpected");
  }
});

test("limits apply at their boundaries and to pretty-printed output", () => {
  assert.doesNotThrow(() => checkDocumentLimits("a".repeat(maximumCharacters)));
  assert.throws(() => checkDocumentLimits("a".repeat(maximumCharacters + 1)), inputError("limit"));
  assert.doesNotThrow(() => checkDocumentLimits("\n".repeat(maximumLines - 1)));
  assert.throws(() => checkDocumentLimits("\n".repeat(maximumLines)), inputError("limit"));
  const nested = (depth: number): string => `${"[".repeat(depth)}0${"]".repeat(depth)}`;
  assert.doesNotThrow(() => formatJson(nested(maximumJsonDepth), true));
  assert.throws(() => formatJson(nested(maximumJsonDepth + 1), true), inputError("depth"));
  assert.throws(() => formatJson(nested(10_000), true), inputError("depth"));
  assert.throws(() => formatJson(JSON.stringify(Array(2_000).fill(0))), inputError("limit"));
  assert.equal(formatJson(JSON.stringify(Array(2_000).fill(0)), true), JSON.stringify(Array(2_000).fill(0)));
});

test("line diffs reconstruct both documents and preserve final-newline differences", () => {
  for (const [before, after] of [
    ["", ""],
    ["", "added\n"],
    ["removed", ""],
    ["a\nb\nc\n", "a\nx\nc\n"],
    ["line", "line\n"],
    ["a\n\nb", "a\nb"],
    ["repeat\nrepeat\nlast", "repeat\nlast\nrepeat"],
    ["<script>alert(1)</script>\n", "Unicode: \u6771\u4eac \ud83d\ude80\n"],
  ]) {
    const changes = compareDocuments(before!, after!);
    for (const line of changes) {
      assert.equal(line.parts.map((part) => part.value).join(""), line.value);
    }
    assert.equal(
      changes
        .filter((change) => !change.added)
        .map((change) => change.value)
        .join(""),
      before,
    );
    assert.equal(
      changes
        .filter((change) => !change.removed)
        .map((change) => change.value)
        .join(""),
      after,
    );
  }
  assert.ok(compareDocuments("line", "line\n").some((change) => change.added || change.removed));
  assert.ok(compareDocuments("a\r\nb\r\n", "a\nb\n").every((change) => !change.added && !change.removed));
  assert.ok(compareDocuments("  a \n", "a\n", true).every((change) => !change.added && !change.removed));
  assert.ok(compareDocuments("a b", "ab", true).some((change) => change.added || change.removed));
});

test("inline highlights identify exact character edits rather than whole lines", () => {
  const changes = compareDocuments("prefix 100 suffix\n", "prefix 101 suffix\n");
  const removed = changes.find((line) => line.removed);
  const added = changes.find((line) => line.added);
  assert.ok(removed && added);
  assert.deepEqual(removed.parts, [
    { value: "prefix 10", changed: false },
    { value: "0", changed: true },
    { value: " suffix\n", changed: false },
  ]);
  assert.deepEqual(added.parts, [
    { value: "prefix 10", changed: false },
    { value: "1", changed: true },
    { value: " suffix\n", changed: false },
  ]);
  const separateEdits = compareDocuments("abc xyz\n", "aBc xyZ\n");
  assert.deepEqual(
    separateEdits
      .find((line) => line.added)
      ?.parts.filter((part) => part.changed)
      .map((part) => part.value),
    ["B", "Z"],
  );
  const deletion = compareDocuments("prefix middle suffix\n", "prefix suffix\n");
  assert.equal(
    deletion.find((line) => line.added)?.parts.some((part) => part.changed),
    false,
  );
  assert.equal(
    deletion
      .find((line) => line.removed)
      ?.parts.filter((part) => part.changed)
      .map((part) => part.value)
      .join("")
      .trim(),
    "middle",
  );
});

test("character matching spans replacement blocks without mispairing inserted lines", () => {
  const changes = compareDocuments("title=old\ncount=10\n", "note=added\ntitle=new\ncount=11\n");
  const count = changes.find((line) => line.added && line.value.startsWith("count="));
  assert.ok(count);
  assert.deepEqual(count.parts, [
    { value: "count=1", changed: false },
    { value: "1", changed: true },
    { value: "\n", changed: false },
  ]);
  for (const line of changes) assert.equal(line.parts.map((part) => part.value).join(""), line.value);
  const insertion = compareDocuments("kept\n", "kept\nnew\n");
  assert.deepEqual(insertion.find((line) => line.added)?.parts, [{ value: "new\n", changed: true }]);
});

test("character highlights honor ignored edge whitespace and retain Unicode graphemes", () => {
  const trimmed = compareDocuments("  value=10 \n", "value=11\t\n", true);
  assert.deepEqual(
    trimmed.flatMap((line) => line.parts.filter((part) => part.changed).map((part) => part.value)),
    ["0", "1"],
  );
  for (const [before, after] of [
    ["e\u0301", "e\u0300"],
    ["\u{1f469}\u200d\u{1f4bb}", "\u{1f469}\u200d\u{1f52c}"],
  ] as const) {
    const changes = compareDocuments(`prefix ${before} suffix\n`, `prefix ${after} suffix\n`);
    assert.deepEqual(
      changes.flatMap((line) => line.parts.filter((part) => part.changed).map((part) => part.value)),
      [before, after],
    );
  }
});

test("JSON comparison normalizes formatting and optionally object order, but preserves arrays and numbers", () => {
  const differs = (before: string, after: string, sortKeys: boolean): boolean =>
    compareDocuments(formatJson(before, false, sortKeys), formatJson(after, false, sortKeys)).some(
      (change) => change.added || change.removed,
    );
  assert.equal(differs('{"a":1}', '{\n "a": 1\n}', false), false);
  assert.equal(differs('{"b":2,"a":1}', '{"a":1,"b":2}', false), true);
  assert.equal(differs('{"b":2,"a":1}', '{"a":1,"b":2}', true), false);
  assert.equal(differs("[1,2]", "[2,1]", true), true);
  assert.equal(differs("9007199254740992", "9007199254740993", true), true);
});

test("large unrelated diffs report a limit instead of a success-shaped empty result", () => {
  const before = Array.from({ length: 1_100 }, (_, index) => `old-${index}`).join("\n");
  const after = Array.from({ length: 1_100 }, (_, index) => `new-${index}`).join("\n");
  assert.throws(() => compareDocuments(before, after), inputError("comparison"));
  assert.throws(() => compareDocuments("a".repeat(1_100), "b".repeat(1_100)), inputError("comparison"));
});
