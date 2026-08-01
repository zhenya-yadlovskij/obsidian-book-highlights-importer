import { describe, expect, it, vi } from "vitest";
import { createBookAnnotation, createImportSnapshot, createProviderBook } from "../../src/core/models";
import type { DestinationState, NoteRepositoryPort } from "../../src/core/ports";
import { mergeFrontmatter, serializeFrontmatter } from "../../src/notes/frontmatter";
import { parseManagedSection } from "../../src/notes/markers";
import { renderMarkdown } from "../../src/notes/markdown";
import { createManagedNoteService } from "../../src/notes/service";

const book = createProviderBook({
  providerId: "provider",
  bookId: "book",
  title: "Title",
  authors: ["Author"],
  status: "finished",
});

describe("managed note properties", () => {
  const addUserField = (serialized: string, field: string): string => {
    const closing = serialized.lastIndexOf("\n---\n");
    return `${serialized.slice(0, closing)}\n${field}${serialized.slice(closing)}`;
  };

  it("keeps arbitrary user text from creating a second marker boundary", () => {
    const values = [
      "plain text",
      "# heading\n> quote\n*emphasis*",
      "<!-- book-highlights-importer:start version=1 provider=bad book-id=bad -->",
      "<!-- book-highlights-importer:end -->",
      "[!note] callout\n---\nkey: value",
      "backslash \\ and `code` and [link](https://example.test)",
      "line one\n\nline three",
    ];

    for (const text of values) {
      const rendered = renderMarkdown(createImportSnapshot({
        book,
        annotations: [createBookAnnotation({ text, inputIndex: 0 })],
      }));
      const wrapped = `<!-- book-highlights-importer:start version=1 provider=provider book-id=book -->\n${rendered}\n<!-- book-highlights-importer:end -->`;
      const parsed = parseManagedSection(wrapped);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.value.startLine).toBe(0);
      expect(wrapped.match(/^<!-- book-highlights-importer:(?:start|end)/gmu)).toHaveLength(2);
    }
  });

  it("runs a reusable randomized loop over arbitrary marker-like text", () => {
    let state = 0x12345678;
    const next = (): number => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state;
    };
    const alphabet = "-+0123456789.~`#|<>[]!\\*_=()";
    const randomText = (): string => {
      let result = "";
      for (let character = 0; character < 24; character += 1) {
        result += alphabet.charAt(next() % alphabet.length);
      }
      return result;
    };

    for (let sample = 0; sample < 128; sample += 1) {
      const text = `- ${randomText()}\n+ ${randomText()}\n1. ${randomText()}\n<!-- marker-like ${randomText()} -->`;
      const rendered = renderMarkdown(createImportSnapshot({
        book,
        annotations: [createBookAnnotation({ text, inputIndex: sample })],
      }));
      const wrapped = `<!-- book-highlights-importer:start version=1 provider=provider book-id=book -->\n${rendered}\n<!-- book-highlights-importer:end -->`;
      expect(parseManagedSection(wrapped).ok).toBe(true);
      expect(rendered).not.toContain("> - ");
      expect(rendered).not.toContain("> + ");
      expect(rendered).not.toContain("> 1. ");
      expect(rendered).not.toContain("> <!--");

      const old = addUserField(serializeFrontmatter({
        providerId: "provider",
        bookId: "book",
        title: "Old",
        authors: [],
        status: "unknown",
        importedAt: 1,
      }), `user-value: ${JSON.stringify(text)}`) + "body\n";
      const merged = mergeFrontmatter(old, {
        providerId: "provider",
        bookId: "book",
        title: "New",
        authors: [],
        status: "finished",
        importedAt: 2,
      });
      expect(merged.ok).toBe(true);
      if (merged.ok) expect(merged.value).toContain(`user-value: ${JSON.stringify(text)}`);
    }
  });

  it("preserves arbitrary user YAML values while refreshing owned values", () => {
    const values = [
      "# hash and: colon",
      "quotes: \"double\" and 'single'",
      "https://example.test/a?x=1#fragment",
      "line with [brackets] {braces} *stars*",
    ];

    for (const value of values) {
      const old = addUserField(serializeFrontmatter({
        providerId: "provider",
        bookId: "book",
        title: "Old",
        authors: [],
        status: "unknown",
        importedAt: 1,
      }), `user-value: ${JSON.stringify(value)}`) + "body\n";
      const merged = mergeFrontmatter(old, {
        providerId: "provider",
        bookId: "book",
        title: "New",
        authors: [],
        status: "finished",
        importedAt: 2,
      });
      expect(merged.ok).toBe(true);
      if (merged.ok) {
        expect(merged.value).toContain(`user-value: ${JSON.stringify(value)}`);
        expect(merged.value).toContain('book-highlights-title: "New"');
      }
    }
  });

  it("rejects every malformed percent-encoded identity tested", () => {
    const malformed = ["%", "%0", "%GG", "%2f", "%2F%", "%E0%A4%A"];
    for (const encoded of malformed) {
      const content = `<!-- book-highlights-importer:start version=1 provider=${encoded} book-id=book -->\nbody\n<!-- book-highlights-importer:end -->`;
      expect(parseManagedSection(content).ok).toBe(false);
    }
  });

  it("keeps repeated imports to one complete managed section", async () => {
    let content = "";
    const notes: NoteRepositoryPort = {
      inspect: vi.fn((path: string): Promise<DestinationState> => {
        void path;
        return Promise.resolve(content === "" ? { kind: "missing" } : { kind: "managed" });
      }),
      create: vi.fn((_path: string, next: string) => {
        content = next;
        return Promise.resolve();
      }),
      process: vi.fn((_path: string, update: (current: string) => string) => {
        content = update(content);
        return Promise.resolve();
      }),
      open: vi.fn(() => Promise.resolve()),
    };
    const service = createManagedNoteService({ notes, now: () => 1 });

    await service.write("Title.md", createImportSnapshot({
      book,
      annotations: [createBookAnnotation({ text: "first", inputIndex: 0 })],
    }));
    await service.write("Title.md", createImportSnapshot({
      book,
      annotations: [createBookAnnotation({ text: "second", inputIndex: 0 })],
    }));
    await service.write("Title.md", createImportSnapshot({
      book,
      annotations: [createBookAnnotation({ text: "third", inputIndex: 0 })],
    }));

    expect(content.match(/^<!-- book-highlights-importer:start/gmu)).toHaveLength(1);
    expect(content.match(/^<!-- book-highlights-importer:end/gmu)).toHaveLength(1);
    expect(content).toContain("> third");
    expect(content).not.toContain("> first");
    expect(content).not.toContain("> second");
  });
});
