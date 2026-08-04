import { ok, type Result } from "../core/results";

export interface ManagedFrontmatter {
  readonly providerId: string;
  readonly bookId: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly importedAt: number;
}

export interface FrontmatterError {
  readonly category: "invalid-frontmatter";
}

const ownedKeys = new Set([
  "bh-provider",
  "bh-book-id",
  "bh-title",
  "bh-authors",
  "bh-imported-at",
]);

const quote = (value: string): string => JSON.stringify(value);

export const serializeFrontmatter = (metadata: ManagedFrontmatter): string => {
  const lines = [
    `bh-provider: ${quote(metadata.providerId)}`,
    `bh-book-id: ${quote(metadata.bookId)}`,
    `bh-title: ${quote(metadata.title)}`,
    `bh-authors: ${JSON.stringify([...metadata.authors])}`,
    `bh-imported-at: ${quote(new Date(metadata.importedAt).toISOString())}`,
  ];
  return `---\n${lines.join("\n")}\n---\n`;
};

const frontmatterLines = (content: string): { readonly lines: readonly string[]; readonly end: number } | undefined => {
  const lines = content.split("\n");
  if (lines[0] !== "---") return undefined;
  const end = lines.findIndex((line, index) => index > 0 && (line === "---" || line === "..."));
  return end === -1 ? undefined : { lines, end };
};

const parseValue = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return typeof parsed === "string" ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  if (trimmed.startsWith("'")) return trimmed.endsWith("'") ? trimmed.slice(1, -1) : undefined;
  return trimmed === "" ? undefined : trimmed;
};

const parsedTopLevelValues = (content: string): {
  readonly values: ReadonlyMap<string, string>;
  readonly keys: ReadonlySet<string>;
} | undefined => {
  const parsed = frontmatterLines(content);
  if (parsed === undefined) return undefined;
  const values = new Map<string, string>();
  const seenKeys = new Set<string>();
  for (const line of parsed.lines.slice(1, parsed.end)) {
    const match = /^([A-Za-z0-9_-]+):(?:\s+(.*))?$/u.exec(line);
    if (match?.[1] === undefined) continue;
    if (seenKeys.has(match[1])) return undefined;
    seenKeys.add(match[1]);
    if (match[2] === undefined) continue;
    const value = parseValue(match[2]);
    if (value !== undefined) values.set(match[1], value);
  }
  return { values, keys: seenKeys };
};

type IdentityPair = { readonly providerId: string; readonly bookId: string } | "absent" | "invalid";

const identityPair = (
  parsed: { readonly values: ReadonlyMap<string, string>; readonly keys: ReadonlySet<string> },
  providerKey: string,
  bookKey: string,
): IdentityPair => {
  const providerPresent = parsed.keys.has(providerKey);
  const bookPresent = parsed.keys.has(bookKey);
  if (!providerPresent && !bookPresent) return "absent";
  if (!providerPresent || !bookPresent) return "invalid";
  const providerId = parsed.values.get(providerKey);
  const bookId = parsed.values.get(bookKey);
  return providerId === undefined || bookId === undefined ? "invalid" : { providerId, bookId };
};

export const parseFrontmatterIdentity = (content: string): { readonly providerId: string; readonly bookId: string } | undefined => {
  const values = parsedTopLevelValues(content);
  if (values === undefined) return undefined;
  const current = identityPair(values, "bh-provider", "bh-book-id");
  const legacy = identityPair(values, "book-highlights-provider", "book-highlights-book-id");
  if (current === "invalid" || legacy === "invalid") return undefined;
  if (current !== "absent") {
    if (legacy !== "absent" && (legacy.providerId !== current.providerId || legacy.bookId !== current.bookId)) return undefined;
    return current;
  }
  return legacy === "absent" ? undefined : legacy;
};

const ownedKey = (line: string): string | undefined => {
  const match = /^([A-Za-z0-9_-]+):(?:\s|$)/u.exec(line);
  return match?.[1] === undefined || !ownedKeys.has(match[1]) ? undefined : match[1];
};

export const mergeFrontmatter = (content: string, metadata: ManagedFrontmatter): Result<string, FrontmatterError> => {
  const parsed = frontmatterLines(content);
  if (parsed === undefined) return ok(`${serializeFrontmatter(metadata)}${content}`);

  const userLines: string[] = [];
  for (let index = 1; index < parsed.end; index += 1) {
    const key = ownedKey(parsed.lines[index] ?? "");
    if (key !== undefined) {
      index += 1;
      while (index < parsed.end && /^\s+/u.test(parsed.lines[index] ?? "")) index += 1;
      index -= 1;
      continue;
    }
    userLines.push(parsed.lines[index] ?? "");
  }
  const preserved = userLines.length === 0 ? "" : `${userLines.join("\n")}\n`;
  const closing = parsed.lines[parsed.end];
  if (closing === undefined) return ok(`${serializeFrontmatter(metadata)}${content}`);
  const serialized = serializeFrontmatter(metadata);
  const serializedClosing = serialized.lastIndexOf("\n---\n");
  const body = parsed.lines.slice(parsed.end + 1).join("\n");
  return ok(`${serialized.slice(0, serializedClosing)}\n${preserved}${closing}\n${body}`);
};
