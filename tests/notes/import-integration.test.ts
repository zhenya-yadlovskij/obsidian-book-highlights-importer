import { describe, expect, it } from "vitest";

import { createCoreComposition, type CoreComposition } from "../../src/core/composition";
import { createImportWizardController, type ImportWizardController } from "../../src/core/import-wizard";
import { createBookAnnotation, createImportSnapshot, createProviderBook } from "../../src/core/models";
import type { BookAnnotation, ImportSnapshot, ProviderBook } from "../../src/core/models";
import type {
  DestinationState,
  ImportSettings,
  NoteRepositoryPort,
  ProviderResult,
  ReadingProviderPort,
  SettingsRepositoryPort,
} from "../../src/core/ports";

const selectedBook = createProviderBook({
  providerId: "provider",
  bookId: "book-1",
  title: "Title",
  authors: ["Author"],
  status: "finished",
});

const otherBook = createProviderBook({
  providerId: "provider",
  bookId: "other-book",
  title: "Other title",
  authors: ["Other author"],
  status: "finished",
});

const annotation = (text: string, inputIndex: number): BookAnnotation =>
  createBookAnnotation({ text, inputIndex });

const snapshot = (book: ProviderBook, annotations: readonly BookAnnotation[]): ImportSnapshot =>
  createImportSnapshot({ book, annotations });

interface NoteOperations {
  inspect: number;
  create: number;
  process: number;
  open: number;
  effectiveWrites: number;
}

interface MemoryNotes {
  readonly port: NoteRepositoryPort;
  readonly operations: NoteOperations;
  readonly content: () => string | undefined;
  readonly replaceOutsidePlugin: (content: string) => void;
}

interface SettingsOperations {
  load: number;
  save: number;
}

interface MemorySettings {
  readonly port: SettingsRepositoryPort;
  readonly operations: SettingsOperations;
}

const createMemoryNotes = (initial?: string): MemoryNotes => {
  let content = initial;
  const operations: NoteOperations = { inspect: 0, create: 0, process: 0, open: 0, effectiveWrites: 0 };
  const port: NoteRepositoryPort = {
    inspect: (path): Promise<DestinationState> => {
      void path;
      operations.inspect += 1;
      return Promise.resolve(content === undefined ? { kind: "missing" } : { kind: "managed" });
    },
    create: (_path, next): Promise<void> => {
      operations.create += 1;
      content = next;
      operations.effectiveWrites += 1;
      return Promise.resolve();
    },
    process: (_path, update): Promise<void> => {
      operations.process += 1;
      if (content === undefined) return Promise.reject(new Error("missing latest content"));
      const next = update(content);
      content = next;
      operations.effectiveWrites += 1;
      return Promise.resolve();
    },
    open: (path): Promise<void> => {
      void path;
      operations.open += 1;
      return Promise.resolve();
    },
  };
  return {
    port,
    operations,
    content: () => content,
    replaceOutsidePlugin: (next): void => {
      content = next;
    },
  };
};

const createMemorySettings = (): MemorySettings => {
  let settings: ImportSettings = { defaultFolder: "Books" };
  const operations: SettingsOperations = { load: 0, save: 0 };
  return {
    operations,
    port: {
      load: (): Promise<ImportSettings> => {
        operations.load += 1;
        return Promise.resolve(settings);
      },
      save: (next): Promise<void> => {
        operations.save += 1;
        settings = next;
        return Promise.resolve();
      },
    },
  };
};

interface ProviderBehavior {
  readonly listBooks?: () => Promise<ProviderResult<readonly ProviderBook[]>>;
  readonly fetchAnnotations?: (book: ProviderBook) => Promise<ProviderResult<readonly BookAnnotation[]>>;
}

const createProvider = (behavior: ProviderBehavior = {}): ReadingProviderPort => ({
  id: "provider",
  displayName: "Provider",
  annotationFetch: "early",
  testCredential: () => Promise.resolve({ ok: true, value: undefined }),
  listBooks: behavior.listBooks ?? ((): Promise<ProviderResult<readonly ProviderBook[]>> =>
    Promise.resolve({ ok: true, value: [selectedBook] })),
  fetchAnnotations: (_credential, book) => behavior.fetchAnnotations?.(book) ?? Promise.resolve({
    ok: true,
    value: [annotation("Provider highlight", 0)],
  }),
});

interface Workflow {
  readonly composition: CoreComposition;
  readonly controller: ImportWizardController;
  readonly notes: MemoryNotes;
  readonly settings: MemorySettings;
}

const createWorkflow = (provider: ReadingProviderPort, notes = createMemoryNotes()): Workflow => {
  const credentials = { get: (): string => "credential" };
  const settings = createMemorySettings();
  const composition = createCoreComposition([provider], { credentials, settings: settings.port, notes: notes.port });
  const controller = createImportWizardController({
    registry: composition.registry,
    credentials,
    settings: settings.port,
    imports: composition.importUseCase,
    openNote: notes.port.open,
  });
  return { composition, controller, notes, settings };
};

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

const expectNoPreparationOrDestinationOperation = (notes: MemoryNotes, settings: MemorySettings): void => {
  expect(settings.operations).toEqual({ load: 0, save: 0 });
  expect(notes.operations).toMatchObject({ inspect: 0, create: 0, process: 0, effectiveWrites: 0 });
  expect(notes.content()).toBeUndefined();
};

describe("composed import workflow integration", () => {
  it("creates a note, safely re-imports, removes stale annotations, and preserves user content", async () => {
    const { composition, notes } = createWorkflow(createProvider());
    const path = "Books/Title.md";
    const provider = composition.registry.get("provider");
    if (provider === undefined) throw new Error("Missing provider");

    const first = await composition.importUseCase.execute({
      provider,
      book: selectedBook,
      path,
      snapshot: snapshot(selectedBook, [annotation("Stale highlight", 0), annotation("Also stale", 1)]),
    });
    expect(first).toMatchObject({ ok: true, value: { annotationCount: 2 } });
    const initial = notes.content();
    if (initial === undefined) throw new Error("Initial import did not create content");
    expect(initial).toContain('bh-provider: "provider"');
    expect(initial).toContain("book-highlights-importer:start version=1 provider=provider book-id=book-1");
    expect(initial).toContain("> Stale highlight");
    expect(initial).toContain("> Also stale");

    const frontmatterEnd = initial.indexOf("\n---\n");
    if (frontmatterEnd === -1) throw new Error("Missing generated frontmatter");
    const withUserFrontmatter = `${initial.slice(0, frontmatterEnd)}\ntags: [keep]\nrating: 5${initial.slice(frontmatterEnd)}`;
    const managedStart = withUserFrontmatter.indexOf("<!-- book-highlights-importer:start");
    if (managedStart === -1) throw new Error("Missing generated managed section");
    const userBody = "## Personal notes\nKeep this line exactly.";
    notes.replaceOutsidePlugin(`${withUserFrontmatter.slice(0, managedStart)}${userBody}\n${withUserFrontmatter.slice(managedStart)}`);

    const second = await composition.importUseCase.execute({
      provider,
      book: selectedBook,
      path,
      snapshot: snapshot(selectedBook, [annotation("Fresh highlight", 0)]),
    });

    expect(second).toMatchObject({ ok: true, value: { annotationCount: 1 } });
    const updated = notes.content();
    if (updated === undefined) throw new Error("Re-import did not preserve content");
    expect(updated.match(/^tags: \[keep\]$/gmu)).toEqual(["tags: [keep]"]);
    expect(updated.match(/^rating: 5$/gmu)).toEqual(["rating: 5"]);
    expect(updated.startsWith("---\n")).toBe(true);
    const updatedFrontmatterEnd = updated.indexOf("\n---\n", 4);
    expect(updatedFrontmatterEnd).toBeGreaterThan(4);
    expect(updated.slice(4, updatedFrontmatterEnd).split("\n")).toEqual(
      expect.arrayContaining(["tags: [keep]", "rating: 5"]),
    );
    expect(updated.match(/## Personal notes\nKeep this line exactly\./gu)).toEqual([userBody]);
    expect(updated).toContain(`${userBody}\n<!-- book-highlights-importer:start`);
    expect(updated).toContain("> Fresh highlight");
    expect(updated).not.toContain("> Stale highlight");
    expect(updated).not.toContain("> Also stale");
    expect(updated.match(/^<!-- book-highlights-importer:start/gmu)).toHaveLength(1);
    expect(notes.operations).toMatchObject({ inspect: 2, create: 1, process: 1, effectiveWrites: 2 });
  });

  it("rejects another book identity without changing one byte or committing a write", async () => {
    const { composition, notes } = createWorkflow(createProvider());
    const provider = composition.registry.get("provider");
    if (provider === undefined) throw new Error("Missing provider");
    await composition.importUseCase.execute({
      provider,
      book: otherBook,
      path: "Books/Title.md",
      snapshot: snapshot(otherBook, [annotation("Other highlight", 0)]),
    });
    const before = notes.content();
    const writesBefore = notes.operations.effectiveWrites;

    const result = await composition.importUseCase.execute({
      provider,
      book: selectedBook,
      path: "Books/Title.md",
      snapshot: snapshot(selectedBook, [annotation("Must not be written", 0)]),
    });

    expect(result).toEqual({ ok: false, error: { category: "destination-conflict" } });
    expect(notes.content()).toBe(before);
    expect(notes.operations.effectiveWrites).toBe(writesBefore);
  });

  it("rejects an unmanaged existing note without changing one byte or committing a write", async () => {
    const unmanaged = "---\ntags: [personal]\nrating: 5\n---\n# Existing personal note\n\nDo not replace this content.\n";
    const notes = createMemoryNotes(unmanaged);
    const { composition } = createWorkflow(createProvider(), notes);
    const provider = composition.registry.get("provider");
    if (provider === undefined) throw new Error("Missing provider");

    const result = await composition.importUseCase.execute({
      provider,
      book: selectedBook,
      path: "Books/Title.md",
      snapshot: snapshot(selectedBook, [annotation("Must not be written", 0)]),
    });

    expect(result).toEqual({ ok: false, error: { category: "destination-conflict" } });
    expect(notes.content()).toBe(unmanaged);
    expect(notes.operations).toMatchObject({ inspect: 1, create: 0, process: 1, effectiveWrites: 0 });
  });

  it("rejects malformed managed markers without changing one byte or committing a write", async () => {
    const { composition, notes } = createWorkflow(createProvider());
    const provider = composition.registry.get("provider");
    if (provider === undefined) throw new Error("Missing provider");
    await composition.importUseCase.execute({
      provider,
      book: selectedBook,
      path: "Books/Title.md",
      snapshot: snapshot(selectedBook, [annotation("Initial", 0)]),
    });
    const valid = notes.content();
    if (valid === undefined) throw new Error("Initial import did not create content");
    const malformed = valid.replace(
      "<!-- book-highlights-importer:end -->",
      "<!-- book-highlights-importer:end malformed -->",
    );
    notes.replaceOutsidePlugin(malformed);
    const writesBefore = notes.operations.effectiveWrites;

    const result = await composition.importUseCase.execute({
      provider,
      book: selectedBook,
      path: "Books/Title.md",
      snapshot: snapshot(selectedBook, [annotation("Must not be written", 0)]),
    });

    expect(result).toEqual({ ok: false, error: { category: "destination-conflict" } });
    expect(notes.content()).toBe(malformed);
    expect(notes.operations.effectiveWrites).toBe(writesBefore);
  });

  it("cancels pending early annotation preparation and discards its stale completion before settings or destination work", async () => {
    const pending = deferred<ProviderResult<readonly BookAnnotation[]>>();
    const { controller, notes, settings } = createWorkflow(createProvider({ fetchAnnotations: () => pending.promise }));

    await controller.selectProvider("provider");
    const loading = controller.selectBook("book-1");
    expect(controller.getState()).toEqual({
      kind: "loading",
      operation: "annotations",
      providerId: "provider",
      bookId: "book-1",
    });
    controller.cancel();
    pending.resolve({ ok: true, value: [annotation("Stale completion", 0)] });
    await loading;

    expect(controller.getState()).toEqual({ kind: "cancelled" });
    expectNoPreparationOrDestinationOperation(notes, settings);
  });

  it("stops an annotation network failure before destination inspection or writes", async () => {
    const provider = createProvider({
      fetchAnnotations: () => Promise.resolve({
        ok: false,
        error: { category: "provider-unavailable", providerId: "provider" },
      }),
    });
    const { controller, notes, settings } = createWorkflow(provider);

    await controller.selectProvider("provider");
    await controller.selectBook("book-1");

    expect(controller.getState()).toMatchObject({ kind: "error", code: "provider-unavailable", canRetry: true });
    expectNoPreparationOrDestinationOperation(notes, settings);
  });

  it("blocks a provider response with no importable annotations before destination work", async () => {
    const provider = createProvider({
      fetchAnnotations: () => Promise.resolve({
        ok: true,
        value: [createBookAnnotation({ inputIndex: 0 }), createBookAnnotation({ text: "   ", inputIndex: 1 })],
      }),
    });
    const { controller, notes, settings } = createWorkflow(provider);

    await controller.selectProvider("provider");
    await controller.selectBook("book-1");

    expect(controller.getState()).toMatchObject({ kind: "error", code: "empty-snapshot", canRetry: false });
    expectNoPreparationOrDestinationOperation(notes, settings);
  });
});
