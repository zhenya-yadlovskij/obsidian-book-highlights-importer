import { describe, expect, it, vi } from "vitest";
import { createImportUseCase } from "../../src/core/import";
import { createBookAnnotation, createImportSnapshot, createProviderBook } from "../../src/core/models";
import type { DestinationState, NoteRepositoryPort, ProviderResult, ReadingProviderPort, SettingsRepositoryPort } from "../../src/core/ports";

const book = createProviderBook({
  providerId: "provider",
  bookId: "book-1",
  title: "Title",
  authors: ["Author"],
  status: "finished",
});

const snapshot = (text: string, inputIndex = 0): ReturnType<typeof createImportSnapshot> => createImportSnapshot({
  book,
  annotations: [createBookAnnotation({ text, inputIndex })],
});

describe("import use case managed-note integration", () => {
  it("creates and safely re-imports managed content through the confirmed import path", async () => {
    let content: string | undefined;
    const notes: NoteRepositoryPort = {
      inspect: vi.fn((path: string): Promise<DestinationState> => {
        void path;
        return Promise.resolve(content === undefined ? { kind: "missing" } : { kind: "managed" });
      }),
      create: vi.fn((_path: string, next: string) => {
        content = next;
        return Promise.resolve();
      }),
      process: vi.fn((_path: string, update: (current: string) => string) => {
        if (content === undefined) throw new Error("missing latest content");
        content = update(content);
        return Promise.resolve();
      }),
      open: vi.fn(() => Promise.resolve()),
    };
    const settings: SettingsRepositoryPort = {
      load: () => Promise.resolve({ defaultFolder: "Books" }),
      save: () => Promise.resolve(),
    };
    const provider: ReadingProviderPort = {
      id: "provider",
      displayName: "Provider",
      annotationFetch: "early",
      testCredential: (): Promise<ProviderResult<void>> => Promise.resolve({ ok: true, value: undefined }),
      listBooks: (): Promise<ProviderResult<readonly typeof book[]>> => Promise.resolve({ ok: true, value: [book] }),
      fetchAnnotations: (): Promise<ProviderResult<readonly ReturnType<typeof createBookAnnotation>[]>> => Promise.resolve({ ok: true, value: [] }),
    };
    const useCase = createImportUseCase({ credentials: { get: () => "credential" }, settings, notes });

    const first = await useCase.execute({ provider, book, path: "Books/Title.md", confirmed: true, snapshot: snapshot("Old highlight") });
    expect(first).toMatchObject({ ok: true, value: { annotationCount: 1 } });
    expect(content).toContain('book-highlights-provider: "provider"');
    expect(content).toContain("book-highlights-importer:start version=1 provider=provider book-id=book-1");

    if (content === undefined) throw new Error("initial import did not create content");
    content = content.replace("---\n<!-- book-highlights-importer:start", 'tags: [keep]\n---\n<!-- book-highlights-importer:start');
    content = `${content}\nUser-authored body\n`;
    const second = await useCase.execute({ provider, book, path: "Books/Title.md", confirmed: true, snapshot: snapshot("Fresh highlight") });

    expect(second).toMatchObject({ ok: true, value: { annotationCount: 1 } });
    expect(content).toContain("tags: [keep]");
    expect(content).toContain("User-authored body");
    expect(content).toContain("> Fresh highlight");
    expect(content).not.toContain("> Old highlight");
    expect(content.match(/^<!-- book-highlights-importer:start/gmu)).toHaveLength(1);
    expect(notes.create).toHaveBeenCalledOnce();
    expect(notes.process).toHaveBeenCalledOnce();
  });
});
