import { describe, expect, it, vi, type Mock } from "vitest";
import { createBookAnnotation, createImportSnapshot, createProviderBook } from "../../src/core/models";
import type { NoteRepositoryPort } from "../../src/core/ports";
import { createManagedSection } from "../../src/notes/markers";
import { serializeFrontmatter } from "../../src/notes/frontmatter";
import { createManagedNoteService } from "../../src/notes/service";

const book = createProviderBook({
  providerId: "provider",
  bookId: "book-1",
  title: "Title",
  authors: ["Author"],
  status: "finished",
});

const snapshot = (text: string): ReturnType<typeof createImportSnapshot> => createImportSnapshot({
  book,
  annotations: [createBookAnnotation({ text, inputIndex: 0 })],
  fetchedAt: 100,
});

interface TestRepository extends NoteRepositoryPort {
  readonly writes: string[];
  readonly ensureFolder: Mock<(folder: string) => Promise<void>>;
  readonly create: Mock<(path: string, content: string) => Promise<void>>;
}

const repository = (state: "missing" | "managed" | "conflict", current = "", inspectionFailure = false): TestRepository => {
  const writes: string[] = [];
  const ensureFolder = vi.fn<(folder: string) => Promise<void>>().mockImplementation((folder) => {
    void folder;
    return Promise.resolve();
  });
  return {
    writes,
    inspect: vi.fn(() => inspectionFailure ? Promise.reject(new Error("vault unavailable")) : Promise.resolve({ kind: state })),
    create: vi.fn((_path: string, content: string) => {
      writes.push(content);
      return Promise.resolve();
    }),
    process: vi.fn((_path: string, update: (current: string) => string) => {
      writes.push(update(current));
      return Promise.resolve();
    }),
    ensureFolder,
    open: vi.fn(() => Promise.resolve()),
  };
};

describe("managed note service", () => {
  it("validates and renders before one create operation", async () => {
    const notes = repository("missing");
    const service = createManagedNoteService({ notes, now: () => 200 });

    const result = await service.write("Books/Title.md", snapshot("Highlight"));

    expect(result).toEqual({ ok: true, value: { path: "Books/Title.md", annotationCount: 1 } });
    expect(notes.create).toHaveBeenCalledOnce();
    expect(notes.process).not.toHaveBeenCalled();
    const firstWrite = notes.writes[0];
    expect(firstWrite).toBeDefined();
    if (firstWrite !== undefined) {
      expect(firstWrite).toContain("<!-- book-highlights-importer:start version=1 provider=provider book-id=book-1 -->");
      expect(firstWrite).toContain("> Highlight");
    }
  });

  it("ensures a missing destination folder before creating a note", async () => {
    const notes = repository("missing");
    const service = createManagedNoteService({ notes });

    const result = await service.write("Books/Title.md", snapshot("Highlight"));

    expect(result).toEqual({ ok: true, value: { path: "Books/Title.md", annotationCount: 1 } });
    expect(notes.ensureFolder).toHaveBeenCalledWith("Books");
    expect(notes.ensureFolder).toHaveBeenCalledBefore(notes.create);
  });

  it("does not create a note when its destination folder cannot be created", async () => {
    const notes = repository("missing");
    notes.ensureFolder.mockRejectedValue(new Error("folder unavailable"));
    const service = createManagedNoteService({ notes });

    const result = await service.write("Books/Title.md", snapshot("Highlight"));

    expect(result).toEqual({ ok: false, error: { category: "destination-unavailable" } });
    expect(notes.create).not.toHaveBeenCalled();
    expect(notes.process).not.toHaveBeenCalled();
  });

  it("cancels after folder preparation without creating the note", async () => {
    let active = true;
    const notes = repository("missing");
    notes.ensureFolder.mockImplementation(() => {
      active = false;
      return Promise.resolve();
    });
    const service = createManagedNoteService({ notes });

    const result = await service.write("Books/Title.md", snapshot("Highlight"), () => active);

    expect(result).toEqual({ ok: false, error: { category: "cancelled" } });
    expect(notes.create).not.toHaveBeenCalled();
  });

  it("processes the latest content and replaces the complete managed snapshot", async () => {
    const existing = [
      "---",
      'book-highlights-provider: "provider"',
      'book-highlights-book-id: "book-1"',
      'book-highlights-title: "Old"',
      'book-highlights-authors: ["Author"]',
      'book-highlights-status: "finished"',
      "book-highlights-imported-at: 99",
      "tags: [keep]",
      "---",
      "User text before",
      "<!-- book-highlights-importer:start version=1 provider=provider book-id=book-1 -->",
      "# Old",
      "> Stale highlight",
      "<!-- book-highlights-importer:end -->",
      "User text after",
    ].join("\n");
    const notes = repository("managed", existing);
    const service = createManagedNoteService({ notes, now: () => 200 });

    const result = await service.write("Books/Title.md", snapshot("Fresh highlight"));

    expect(result.ok).toBe(true);
    expect(notes.process).toHaveBeenCalledOnce();
    const updated = notes.writes[0];
    expect(updated).toBeDefined();
    if (updated !== undefined) {
      expect(updated).toContain("User text before");
      expect(updated).toContain("User text after");
      expect(updated).toContain("> Fresh highlight");
      expect(updated).not.toContain("> Stale highlight");
      expect(updated.match(/book-highlights-importer:start/gu)).toHaveLength(1);
      expect(updated).toContain("tags: [keep]");
      expect(updated).toContain('bh-title: "Title"');
      expect(updated).toContain('book-highlights-title: "Old"');
    }
  });

  it("rejects conflicts and malformed existing managed notes without writing", async () => {
    const conflictNotes = repository("conflict");
    const conflict = await createManagedNoteService({ notes: conflictNotes }).write("Books/Title.md", snapshot("text"));
    expect(conflict).toEqual({ ok: false, error: { category: "destination-conflict" } });
    expect(conflictNotes.create).not.toHaveBeenCalled();
    expect(conflictNotes.process).not.toHaveBeenCalled();

    const malformedNotes = repository("managed", "---\ntags: [keep]\n---\nbody\n");
    const malformed = await createManagedNoteService({ notes: malformedNotes }).write("Books/Title.md", snapshot("text"));
    expect(malformed).toEqual({ ok: false, error: { category: "destination-conflict" } });
    expect(malformedNotes.create).not.toHaveBeenCalled();
    expect(malformedNotes.process).toHaveBeenCalledOnce();
    expect(malformedNotes.writes).toHaveLength(0);
  });

  it("returns a typed conflict when destination inspection fails", async () => {
    const notes = repository("missing", "", true);

    const result = await createManagedNoteService({ notes }).write("Books/Title.md", snapshot("text"));

    expect(result).toEqual({ ok: false, error: { category: "destination-conflict" } });
    expect(notes.create).not.toHaveBeenCalled();
    expect(notes.process).not.toHaveBeenCalled();
    expect(notes.writes).toHaveLength(0);
  });

  it("rejects a valid managed note whose identity differs from the requested book", async () => {
    const otherIdentity = { providerId: "provider", bookId: "other-book" } as const;
    const existing = `${serializeFrontmatter({
      providerId: otherIdentity.providerId,
      bookId: otherIdentity.bookId,
      title: "Other",
      authors: ["Author"],
      importedAt: 1,
    })}${createManagedSection(otherIdentity, "# Other\n")}`;
    const notes = repository("managed", existing);

    const result = await createManagedNoteService({ notes }).write("Books/Title.md", snapshot("text"));

    expect(result).toEqual({ ok: false, error: { category: "destination-conflict" } });
    expect(notes.writes).toHaveLength(0);
  });

  it("rejects control characters in marker identity before any write", async () => {
    const invalid = createImportSnapshot({
      book: createProviderBook({
        providerId: "provider\u0000",
        bookId: "book-1",
        title: "Title",
        authors: ["Author"],
        status: "finished",
      }),
      annotations: [createBookAnnotation({ text: "text", inputIndex: 0 })],
    });
    const notes = repository("missing");

    const result = await createManagedNoteService({ notes }).write("Books/Title.md", invalid);

    expect(result).toEqual({ ok: false, error: { category: "invalid-snapshot" } });
    expect(notes.inspect).not.toHaveBeenCalled();
    expect(notes.create).not.toHaveBeenCalled();
    expect(notes.process).not.toHaveBeenCalled();
    expect(notes.writes).toHaveLength(0);
  });

  it("rejects duplicate owned identity keys without processing the note", async () => {
    const identity = serializeFrontmatter({
      providerId: book.providerId,
      bookId: book.bookId,
      title: book.title,
      authors: book.authors,
      importedAt: 1,
    }).replace(
      'bh-book-id: "book-1"',
      'bh-book-id: "book-1"\nbh-book-id: "other-book"',
    );
    const existing = `${identity}${createManagedSection({ providerId: book.providerId, bookId: book.bookId }, "# Title\n")}`;
    const notes = repository("managed", existing);

    const result = await createManagedNoteService({ notes }).write("Books/Title.md", snapshot("text"));

    expect(result).toEqual({ ok: false, error: { category: "destination-conflict" } });
    expect(notes.process).toHaveBeenCalledOnce();
    expect(notes.writes).toHaveLength(0);
  });

  it("does not write when validation or rendering fails", async () => {
    const notes = repository("missing");
    const render = vi.fn(() => {
      throw new Error("render failure");
    });
    const service = createManagedNoteService({ notes, render });
    const empty = createImportSnapshot({ book, annotations: [] });

    expect(await service.write("Books/Title.md", empty)).toEqual({ ok: false, error: { category: "empty-snapshot" } });
    expect(await service.write("Books/Title.md", snapshot("text"))).toEqual({ ok: false, error: { category: "rendering-failed" } });
    expect(notes.create).not.toHaveBeenCalled();
    expect(notes.process).not.toHaveBeenCalled();
  });

  it("rejects blank note identity before rendering or inspecting the destination", async () => {
    const notes = repository("missing");
    const invalid = createImportSnapshot({
      book: createProviderBook({
        providerId: "",
        bookId: "",
        title: "Title",
        authors: [],
        status: "unknown",
      }),
      annotations: [createBookAnnotation({ text: "text", inputIndex: 0 })],
    });
    const render = vi.fn(() => "body");

    const result = await createManagedNoteService({ notes, render }).write("Title.md", invalid);

    expect(result).toEqual({ ok: false, error: { category: "invalid-snapshot" } });
    expect(render).not.toHaveBeenCalled();
    expect(notes.inspect).not.toHaveBeenCalled();
    expect(notes.create).not.toHaveBeenCalled();
  });
});
