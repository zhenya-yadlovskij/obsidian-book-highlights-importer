import { describe, expect, it } from "vitest";
import { createBookAnnotation, createImportSnapshot, createProviderBook } from "../../src/core/models";
import {
  mergeFrontmatter,
  parseFrontmatterIdentity,
  serializeFrontmatter,
  type ManagedFrontmatter,
} from "../../src/notes/frontmatter";

const metadata: ManagedFrontmatter = {
  providerId: "provider",
  bookId: "book-1",
  title: "A: title # 1",
  authors: ["Author", "A # B"],
  importedAt: 123,
};

describe("managed frontmatter", () => {
  const addUserFields = (serialized: string, fields: string): string => {
    const closing = serialized.lastIndexOf("\n---\n");
    return `${serialized.slice(0, closing)}\n${fields}${serialized.slice(closing)}`;
  };

  it("serializes YAML-safe owned values", () => {
    const serialized = serializeFrontmatter(metadata);

    expect(serialized).toContain('bh-title: "A: title # 1"');
    expect(serialized).toContain('bh-authors: ["Author","A # B"]');
    expect(serialized).toContain('bh-imported-at: "1970-01-01T00:00:00.123Z"');
    expect(serialized).not.toContain("bh-status:");
    expect(serialized).not.toContain("bh-source-url:");
    expect(parseFrontmatterIdentity(serialized)).toEqual({ providerId: "provider", bookId: "book-1" });
  });

  it("rejects duplicate frontmatter keys instead of selecting the last value", () => {
    const duplicate = serializeFrontmatter(metadata).replace(
      'bh-book-id: "book-1"',
      'bh-book-id: "book-1"\nbh-book-id: "other-book"',
    );

    expect(parseFrontmatterIdentity(duplicate)).toBeUndefined();
  });

  it("refreshes all owned fields, removes absent optional fields, and preserves user keys and body", () => {
    const old = `${addUserFields(
      serializeFrontmatter(metadata),
      'book-highlights-provider: "legacy-provider"\nbook-highlights-book-id: "legacy-book"\nbook-highlights-title: "Legacy title"\ntags: ["keep", "#tag"]\nrating: 5',
    )}User body\n`;
    const next: ManagedFrontmatter = {
      providerId: metadata.providerId,
      bookId: metadata.bookId,
      title: "New title",
      authors: metadata.authors,
      importedAt: 456,
    };

    const merged = mergeFrontmatter(old, next);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.value).toContain("tags: [\"keep\", \"#tag\"]");
    expect(merged.value).toContain("rating: 5");
    expect(merged.value).toContain("User body");
    expect(merged.value).toContain('bh-title: "New title"');
    expect(merged.value).not.toContain("bh-source-url");
    expect(merged.value.match(/^bh-provider:/gmu)).toHaveLength(1);
    expect(merged.value).toContain('book-highlights-title: "Legacy title"');
    expect(merged.value.match(/^---$/gmu)).toHaveLength(2);
  });

  it("uses the legacy identity only when the current identity is absent", () => {
    const legacy = [
      "---",
      'book-highlights-provider: "legacy-provider"',
      'book-highlights-book-id: "legacy-book"',
      "---",
      "body",
    ].join("\n");
    expect(parseFrontmatterIdentity(legacy)).toEqual({ providerId: "legacy-provider", bookId: "legacy-book" });
  });

  it.each([
    ["partial current identity", '---\nbh-provider: "provider"\n---\nbody'],
    ["partial legacy identity", '---\nbook-highlights-book-id: "book"\n---\nbody'],
    ["conflicting identities", '---\nbh-provider: "provider"\nbh-book-id: "book"\nbook-highlights-provider: "other"\nbook-highlights-book-id: "book"\n---\nbody'],
  ])("rejects %s", (_name, content) => {
    expect(parseFrontmatterIdentity(content)).toBeUndefined();
  });

  it("can add owned frontmatter without changing an existing body", () => {
    const snapshot = createImportSnapshot({
      book: createProviderBook({
        providerId: "provider",
        bookId: "book-1",
        title: "Title",
        authors: [],
        status: "unknown",
      }),
      annotations: [createBookAnnotation({ text: "text", inputIndex: 0 })],
    });
    const merged = mergeFrontmatter("User body\n", {
      providerId: snapshot.book.providerId,
      bookId: snapshot.book.bookId,
      title: snapshot.book.title,
      authors: snapshot.book.authors,
      importedAt: 1,
    });

    expect(merged.ok).toBe(true);
    if (merged.ok) expect(merged.value).toContain("User body\n");
  });
});
