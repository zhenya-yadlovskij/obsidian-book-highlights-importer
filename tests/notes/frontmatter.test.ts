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
  status: "finished",
  sourceUrl: "https://example.test/book?a=1#part",
  importedAt: 123,
};

describe("managed frontmatter", () => {
  const addUserFields = (serialized: string, fields: string): string => {
    const closing = serialized.lastIndexOf("\n---\n");
    return `${serialized.slice(0, closing)}\n${fields}${serialized.slice(closing)}`;
  };

  it("serializes YAML-safe owned values", () => {
    const serialized = serializeFrontmatter(metadata);

    expect(serialized).toContain('book-highlights-title: "A: title # 1"');
    expect(serialized).toContain('book-highlights-authors: ["Author","A # B"]');
    expect(serialized).toContain('book-highlights-source-url: "https://example.test/book?a=1#part"');
    expect(parseFrontmatterIdentity(serialized)).toEqual({ providerId: "provider", bookId: "book-1" });
  });

  it("rejects duplicate frontmatter keys instead of selecting the last value", () => {
    const duplicate = serializeFrontmatter(metadata).replace(
      'book-highlights-book-id: "book-1"',
      'book-highlights-book-id: "book-1"\nbook-highlights-book-id: "other-book"',
    );

    expect(parseFrontmatterIdentity(duplicate)).toBeUndefined();
  });

  it("refreshes all owned fields, removes absent optional fields, and preserves user keys and body", () => {
    const old = `${addUserFields(serializeFrontmatter(metadata), 'tags: ["keep", "#tag"]\nrating: 5')}User body\n`;
    const next: ManagedFrontmatter = {
      providerId: metadata.providerId,
      bookId: metadata.bookId,
      title: "New title",
      authors: metadata.authors,
      status: metadata.status,
      importedAt: 456,
    };

    const merged = mergeFrontmatter(old, next);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.value).toContain("tags: [\"keep\", \"#tag\"]");
    expect(merged.value).toContain("rating: 5");
    expect(merged.value).toContain("User body");
    expect(merged.value).toContain('book-highlights-title: "New title"');
    expect(merged.value).not.toContain("book-highlights-source-url");
    expect(merged.value.match(/book-highlights-provider:/gu)).toHaveLength(1);
    expect(merged.value.match(/^---$/gmu)).toHaveLength(2);
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
      status: snapshot.book.status,
      importedAt: 1,
    });

    expect(merged.ok).toBe(true);
    if (merged.ok) expect(merged.value).toContain("User body\n");
  });
});
