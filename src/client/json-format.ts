import { parseTree, printParseErrorCode } from "jsonc-parser";
import type { Node, ParseError } from "jsonc-parser";
import {
  checkDocumentLimits,
  DocumentInputError,
  maximumCharacters,
  maximumJsonDepth,
  maximumLines,
} from "./document-limits.ts";

export function formatJson(source: string, compact = false, sortKeys = false): string {
  checkDocumentLimits(source);
  const errors: ParseError[] = [];
  let root: Node | undefined;
  try {
    root = parseTree(source, errors, { disallowComments: true, allowTrailingComma: false });
  } catch (error: unknown) {
    if (error instanceof RangeError) throw new DocumentInputError("depth");
    throw error;
  }
  const firstError = errors[0];
  if (firstError) {
    throw new DocumentInputError("syntax", firstError.offset, printParseErrorCode(firstError.error));
  }
  if (!root) throw new DocumentInputError("syntax", 0, "ValueExpected");

  const pieces: string[] = [];
  let length = 0;
  let lines = 1;
  const write = (text: string): void => {
    length += text.length;
    lines += text.split("\n").length - 1;
    if (length > maximumCharacters || lines > maximumLines) throw new DocumentInputError("limit");
    pieces.push(text);
  };
  const indent = (depth: number): void => {
    if (!compact) write(`\n${"  ".repeat(depth)}`);
  };
  const render = (node: Node, depth: number): void => {
    if (node.type !== "object" && node.type !== "array") {
      // Read number tokens from the source instead of serializing rounded JavaScript numbers.
      if (node.type === "string") {
        if (typeof node.value !== "string") throw new Error("Invalid JSON string node");
        write(JSON.stringify(node.value));
      } else {
        write(source.slice(node.offset, node.offset + node.length));
      }
      return;
    }
    if (depth >= maximumJsonDepth) throw new DocumentInputError("depth", node.offset);
    const isObject = node.type === "object";
    const seen = new Set<string>();
    const children = (node.children ?? []).map((child) => {
      if (!isObject) return { key: undefined, node: child };
      const [key, value] = child.children ?? [];
      if (!key || !value || typeof key.value !== "string") throw new Error("Invalid JSON property node");
      if (seen.has(key.value)) throw new DocumentInputError("duplicate", key.offset);
      seen.add(key.value);
      return { key: key.value, node: value };
    });
    if (sortKeys && isObject) {
      children.sort((left, right) => (left.key! < right.key! ? -1 : left.key! > right.key! ? 1 : 0));
    }
    write(isObject ? "{" : "[");
    for (const [index, child] of children.entries()) {
      if (index) write(",");
      indent(depth + 1);
      if (child.key !== undefined) {
        write(JSON.stringify(child.key));
        write(compact ? ":" : ": ");
      }
      render(child.node, depth + 1);
    }
    if (children.length) indent(depth);
    write(isObject ? "}" : "]");
  };
  render(root, 0);
  return pieces.join("");
}
