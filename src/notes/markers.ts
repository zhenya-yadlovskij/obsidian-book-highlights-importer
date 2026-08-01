import { failure, ok, type Result } from "../core/results";

export interface MarkerIdentity {
  readonly providerId: string;
  readonly bookId: string;
}

export interface ManagedSection {
  readonly identity: MarkerIdentity;
  readonly startLine: number;
  readonly endLine: number;
  readonly body: string;
}

export interface MarkerError {
  readonly category: "malformed-marker" | "unsupported-marker-version" | "duplicate-marker";
}

const hasControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
};

const encode = (value: string): string => {
  if (hasControlCharacter(value)) throw new Error("marker identity contains a control character");
  return encodeURIComponent(value).replace(/[!'()*]/gu, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
};

const decodeCanonical = (value: string): string | undefined => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return undefined;
  }
  if (decoded === "" || encode(decoded) !== value) return undefined;
  for (const character of decoded) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return undefined;
  }
  return decoded;
};

export const encodeMarkerIdentity = (identity: MarkerIdentity): { readonly provider: string; readonly bookId: string } => ({
  provider: encode(identity.providerId),
  bookId: encode(identity.bookId),
});

const startMarker = (identity: MarkerIdentity): string => {
  const encoded = encodeMarkerIdentity(identity);
  return `<!-- book-highlights-importer:start version=1 provider=${encoded.provider} book-id=${encoded.bookId} -->`;
};

const endMarker = "<!-- book-highlights-importer:end -->";

export const createManagedSection = (identity: MarkerIdentity, body: string): string => {
  const normalizedBody = body.replace(/\n+$/gu, "");
  return `${startMarker(identity)}\n${normalizedBody}\n${endMarker}`;
};

const markerLike = (line: string): boolean => line.startsWith("<!-- book-highlights-importer:");

const parseStart = (line: string): Result<MarkerIdentity, MarkerError> => {
  const match = /^<!-- book-highlights-importer:start(?: (.*))? -->$/u.exec(line);
  if (match?.[1] === undefined) return failure({ category: "malformed-marker" });

  const attributes = new Map<string, string>();
  for (const token of match[1].split(" ")) {
    const equals = token.indexOf("=");
    if (equals <= 0 || equals === token.length - 1) return failure({ category: "malformed-marker" });
    const key = token.slice(0, equals);
    const value = token.slice(equals + 1);
    if (attributes.has(key)) return failure({ category: "duplicate-marker" });
    attributes.set(key, value);
  }
  if (attributes.get("version") !== "1") {
    return failure({ category: attributes.has("version") ? "unsupported-marker-version" : "malformed-marker" });
  }
  if (attributes.size !== 3 || !attributes.has("provider") || !attributes.has("book-id")) {
    return failure({ category: "malformed-marker" });
  }
  const provider = decodeCanonical(attributes.get("provider") ?? "");
  const bookId = decodeCanonical(attributes.get("book-id") ?? "");
  return provider === undefined || bookId === undefined
    ? failure({ category: "malformed-marker" })
    : ok({ providerId: provider, bookId });
};

export const parseManagedSection = (content: string): Result<ManagedSection, MarkerError> => {
  const lines = content.split("\n").map((line) => line.replace(/\r$/u, ""));
  let start: { readonly line: number; readonly identity: MarkerIdentity } | undefined;
  let end: number | undefined;

  for (let line = 0; line < lines.length; line += 1) {
    const current = lines[line];
    if (current === undefined || !markerLike(current)) continue;
    if (current === endMarker) {
      if (end !== undefined || start === undefined) return failure({ category: "duplicate-marker" });
      end = line;
      continue;
    }
    const parsed = parseStart(current);
    if (!parsed.ok) return parsed;
    if (start !== undefined || end !== undefined) return failure({ category: "duplicate-marker" });
    start = { line, identity: parsed.value };
  }

  if (start === undefined || end === undefined || start.line >= end) return failure({ category: "malformed-marker" });
  return ok({
    identity: start.identity,
    startLine: start.line,
    endLine: end,
    body: lines.slice(start.line + 1, end).join("\n"),
  });
};

export const replaceManagedSection = (
  content: string,
  identity: MarkerIdentity,
  body: string,
): Result<string, MarkerError> => {
  const parsed = parseManagedSection(content);
  if (!parsed.ok) return parsed;
  if (parsed.value.identity.providerId !== identity.providerId || parsed.value.identity.bookId !== identity.bookId) {
    return failure({ category: "malformed-marker" });
  }
  const lines = content.split("\n");
  lines.splice(parsed.value.startLine, parsed.value.endLine - parsed.value.startLine + 1, ...createManagedSection(identity, body).split("\n"));
  return ok(lines.join("\n"));
};
