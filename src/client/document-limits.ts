export const maximumCharacters = 100_000;
export const maximumLines = 2_000;
export const maximumJsonDepth = 100;

export class DocumentInputError extends Error {
  readonly kind: "syntax" | "duplicate" | "depth" | "limit" | "comparison";
  readonly offset: number;
  readonly reason: string;

  constructor(kind: DocumentInputError["kind"], offset = 0, reason = "") {
    super(kind);
    this.name = "DocumentInputError";
    this.kind = kind;
    this.offset = offset;
    this.reason = reason;
  }
}

export function checkDocumentLimits(text: string): void {
  if (text.length > maximumCharacters || text.split(/\r\n|\r|\n/).length > maximumLines) {
    throw new DocumentInputError("limit");
  }
}
