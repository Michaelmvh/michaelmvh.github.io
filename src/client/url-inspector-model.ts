export const maximumUrlLength = 16_384;
export const maximumUrlParameters = 200;

export class UrlInputError extends Error {
  readonly kind: "invalid" | "encoding" | "limit";

  constructor(kind: UrlInputError["kind"]) {
    super(kind);
    this.name = "UrlInputError";
    this.kind = kind;
  }
}

export interface UrlParameter {
  name: string;
  value: string;
  raw?: string;
}

export interface InspectedUrl {
  prefix: string;
  fragment: string;
  hasQuery: boolean;
  parameters: UrlParameter[];
}

export function isTrackingParameter(name: string): boolean {
  return (
    /^utm_/i.test(name) ||
    [
      "gclid",
      "dclid",
      "fbclid",
      "msclkid",
      "mc_cid",
      "mc_eid",
      "igshid",
      "_ga",
      "_gl",
      "yclid",
      "ttclid",
    ].includes(name.toLowerCase())
  );
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch (error: unknown) {
    if (error instanceof URIError) throw new UrlInputError("encoding");
    throw error;
  }
}

export function inspectUrl(input: string): InspectedUrl {
  if (input.length > maximumUrlLength) throw new UrlInputError("limit");
  const source = input.trim();
  if (!/^https?:\/\//i.test(source) || /[\r\n\t]/.test(source)) throw new UrlInputError("invalid");
  let url: URL;
  try {
    url = new URL(source);
  } catch (error: unknown) {
    if (error instanceof TypeError) throw new UrlInputError("invalid");
    throw error;
  }
  const hash = url.href.indexOf("#");
  const beforeHash = hash < 0 ? url.href : url.href.slice(0, hash);
  const query = beforeHash.indexOf("?");
  const sourceHash = source.indexOf("#");
  const rawQuery =
    query < 0 ? "" : source.slice(source.indexOf("?") + 1, sourceHash < 0 ? undefined : sourceHash);
  const segments = rawQuery ? rawQuery.split("&") : [];
  if (segments.length > maximumUrlParameters) throw new UrlInputError("limit");
  const result: InspectedUrl = {
    prefix: query < 0 ? beforeHash : beforeHash.slice(0, query),
    fragment: hash < 0 ? "" : url.href.slice(hash),
    hasQuery: query >= 0,
    parameters: segments.map((raw) => {
      const equals = raw.indexOf("=");
      return {
        raw,
        name: decode(equals < 0 ? raw : raw.slice(0, equals)),
        value: decode(equals < 0 ? "" : raw.slice(equals + 1)),
      };
    }),
  };
  serializeUrl(result);
  return result;
}

export function serializeUrl(document: InspectedUrl): string {
  if (document.parameters.length > maximumUrlParameters) throw new UrlInputError("limit");
  const query = document.parameters
    .map((parameter) => {
      if (parameter.raw !== undefined) return parameter.raw;
      try {
        return `${encodeURIComponent(parameter.name)}=${encodeURIComponent(parameter.value)}`;
      } catch (error: unknown) {
        if (error instanceof URIError) throw new UrlInputError("encoding");
        throw error;
      }
    })
    .join("&");
  const result =
    document.prefix +
    (document.hasQuery || document.parameters.length ? `?${query}` : "") +
    document.fragment;
  if (result.length > maximumUrlLength) throw new UrlInputError("limit");
  return result;
}
