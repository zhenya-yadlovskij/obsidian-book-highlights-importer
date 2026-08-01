import { describe, expect, it, vi } from "vitest";
import { createImportUseCase } from "../../src/core/import";
import { createBookAnnotation, createProviderBook } from "../../src/core/models";
import type { BookAnnotation, ProviderBook } from "../../src/core/models";
import type { ProviderResult, ReadingProviderPort, SettingsRepositoryPort } from "../../src/core/ports";

const selectedBook = createProviderBook({
  providerId: "provider",
  bookId: "book",
  title: "Title",
  authors: ["Author"],
  status: "finished",
});

const makeProvider = (annotationFetch: "early" | "deferred"): ReadingProviderPort => ({
  id: "provider",
  displayName: "Provider",
  annotationFetch,
  testCredential: vi.fn((): Promise<ProviderResult<void>> => Promise.resolve({ ok: true, value: undefined })),
  listBooks: vi.fn((): Promise<ProviderResult<readonly ProviderBook[]>> => Promise.resolve({ ok: true, value: [selectedBook] })),
  fetchAnnotations: vi.fn((): Promise<ProviderResult<readonly BookAnnotation[]>> => Promise.resolve({
    ok: true,
    value: [createBookAnnotation({ text: "Highlight", inputIndex: 0 })],
  })),
});

const settings: SettingsRepositoryPort = {
  load: vi.fn(() => Promise.resolve({ defaultFolder: "Books" })),
  save: vi.fn(() => Promise.resolve()),
};

describe("import use case", () => {
  it("stops before provider access when the credential is missing", async () => {
    const provider = makeProvider("early");
    const result = await createImportUseCase({
      credentials: { get: vi.fn(() => null) },
      settings,
      notes: { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() },
    }).loadLibrary(provider);

    expect(result).toEqual({ ok: false, error: { category: "missing-credential", providerId: "provider" } });
    expect(provider.listBooks).not.toHaveBeenCalled();
  });

  it("rereads the credential before each provider operation", async () => {
    const provider = makeProvider("early");
    const get = vi.fn().mockReturnValueOnce("first").mockReturnValueOnce("second");
    const useCase = createImportUseCase({
      credentials: { get },
      settings,
      notes: { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() },
    });

    await useCase.loadLibrary(provider);
    await useCase.fetchAnnotations(provider, selectedBook);

    expect(get).toHaveBeenCalledTimes(2);
    expect(provider.listBooks).toHaveBeenCalledWith("first");
    expect(provider.fetchAnnotations).toHaveBeenCalledWith("second", selectedBook);
  });

  it("fetches during preparation only for an early-fetch provider", async () => {
    const earlyProvider = makeProvider("early");
    const earlyUseCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings,
      notes: { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() },
    });
    const early = await earlyUseCase.prepareSnapshot(earlyProvider, selectedBook);

    expect(early.ok).toBe(true);
    expect(earlyProvider.fetchAnnotations).toHaveBeenCalledOnce();

    const deferredProvider = makeProvider("deferred");
    const deferredUseCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings,
      notes: { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() },
    });
    const deferred = await deferredUseCase.prepareSnapshot(deferredProvider, selectedBook);

    expect(deferred).toEqual({ ok: true, value: undefined });
    expect(deferredProvider.fetchAnnotations).not.toHaveBeenCalled();
  });

  it("does not write before confirmation and fetches deferred annotations after confirmation", async () => {
    const provider = makeProvider("deferred");
    const notes = { inspect: vi.fn(() => Promise.resolve({ kind: "missing" as const })), create: vi.fn(), process: vi.fn(), open: vi.fn() };
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings,
      notes,
      render: vi.fn(() => "note"),
    });

    const notConfirmed = await useCase.execute({ provider, book: selectedBook, path: "Books/Title.md", confirmed: false });
    expect(notConfirmed).toEqual({ ok: false, error: { category: "confirmation-required" } });
    expect(provider.fetchAnnotations).not.toHaveBeenCalled();
    expect(notes.inspect).not.toHaveBeenCalled();

    const confirmed = await useCase.execute({ provider, book: selectedBook, path: "Books/Title.md", confirmed: true });
    expect(confirmed).toMatchObject({ ok: true, value: { annotationCount: 1 } });
    expect(provider.fetchAnnotations).toHaveBeenCalledOnce();
    expect(notes.create).toHaveBeenCalledOnce();
  });

  it("does not write an empty snapshot", async () => {
    const provider = makeProvider("early");
    const notes = { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() };
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings,
      notes,
      render: vi.fn(() => "note"),
    });

    const result = await useCase.execute({
      provider,
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: { book: selectedBook, annotations: [] },
    });

    expect(result).toEqual({ ok: false, error: { category: "empty-snapshot" } });
    expect(notes.inspect).not.toHaveBeenCalled();
    expect(notes.create).not.toHaveBeenCalled();
  });

  it("uses the fixed renderer when no custom renderer is supplied", async () => {
    const notes = {
      inspect: vi.fn(() => Promise.resolve({ kind: "missing" as const })),
      create: vi.fn(() => Promise.resolve()),
      process: vi.fn(),
      open: vi.fn(() => Promise.resolve()),
    };
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings,
      notes,
    });

    const result = await useCase.execute({
      provider: makeProvider("early"),
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: { book: selectedBook, annotations: [createBookAnnotation({ text: "A", inputIndex: 0 })] },
    });

    expect(result).toMatchObject({ ok: true, value: { annotationCount: 1 } });
    expect(notes.inspect).toHaveBeenCalledOnce();
    expect(notes.create).toHaveBeenCalledOnce();
  });

  it("does not write when the renderer fails", async () => {
    const notes = { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() };
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings,
      notes,
      render: vi.fn(() => {
        throw new Error("render failed");
      }),
    });

    const result = await useCase.execute({
      provider: makeProvider("early"),
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: { book: selectedBook, annotations: [createBookAnnotation({ text: "A", inputIndex: 0 })] },
    });

    expect(result).toEqual({ ok: false, error: { category: "rendering-failed" } });
    expect(notes.inspect).not.toHaveBeenCalled();
    expect(notes.create).not.toHaveBeenCalled();
  });

  it("does not write when rendering produces empty content", async () => {
    const notes = { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() };
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings,
      notes,
      render: vi.fn(() => ""),
    });

    const result = await useCase.execute({
      provider: makeProvider("early"),
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: { book: selectedBook, annotations: [createBookAnnotation({ text: "A", inputIndex: 0 })] },
    });

    expect(result).toEqual({ ok: false, error: { category: "rendering-failed" } });
    expect(notes.inspect).not.toHaveBeenCalled();
    expect(notes.create).not.toHaveBeenCalled();
  });

  it("rereads a replacement credential for a supplied early snapshot", async () => {
    const get = vi.fn().mockReturnValueOnce("replacement");
    const create = vi.fn(() => Promise.resolve());
    const useCase = createImportUseCase({
      credentials: { get },
      settings,
      notes: { inspect: vi.fn(() => Promise.resolve({ kind: "missing" as const })), create, process: vi.fn(), open: vi.fn() },
      render: vi.fn(() => "note"),
    });

    const result = await useCase.execute({
      provider: makeProvider("early"),
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: { book: selectedBook, annotations: [createBookAnnotation({ text: "A", inputIndex: 0 })] },
    });

    expect(result).toMatchObject({ ok: true });
    expect(get).toHaveBeenCalledWith("provider");
    expect(create).toHaveBeenCalledOnce();
  });

  it("stops when the credential was cleared before a supplied early snapshot executes", async () => {
    const notes = { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() };
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => null) },
      settings,
      notes,
      render: vi.fn(() => "note"),
    });

    const result = await useCase.execute({
      provider: makeProvider("early"),
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: { book: selectedBook, annotations: [createBookAnnotation({ text: "A", inputIndex: 0 })] },
    });

    expect(result).toEqual({ ok: false, error: { category: "missing-credential", providerId: "provider" } });
    expect(notes.inspect).not.toHaveBeenCalled();
  });

  it("validates supplied snapshot identity, state, and filtering before writing", async () => {
    const notes = { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() };
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings,
      notes,
      render: vi.fn(() => "note"),
    });
    const mismatchedBook = createProviderBook({
      providerId: "provider",
      bookId: "other-book",
      title: "Title",
      authors: ["Author"],
      status: "finished",
    });

    const result = await useCase.execute({
      provider: makeProvider("early"),
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: { book: mismatchedBook, annotations: [createBookAnnotation({ text: "A", inputIndex: 0 })] },
    });

    expect(result).toEqual({ ok: false, error: { category: "invalid-snapshot" } });
    expect(notes.inspect).not.toHaveBeenCalled();
  });

  it("rejects stale supplied book state and filters empty annotations", async () => {
    const notes = {
      inspect: vi.fn(() => Promise.resolve({ kind: "missing" as const })),
      create: vi.fn(() => Promise.resolve()),
      process: vi.fn(),
      open: vi.fn(),
    };
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings,
      notes,
      render: vi.fn(() => "note"),
    });
    const staleBook = createProviderBook({
      providerId: "provider",
      bookId: "book",
      title: "Title",
      authors: ["Author"],
      status: "unread",
    });

    const stale = await useCase.execute({
      provider: makeProvider("early"),
      book: selectedBook,
      path: "Books/Stale.md",
      confirmed: true,
      snapshot: { book: staleBook, annotations: [createBookAnnotation({ text: "A", inputIndex: 0 })] },
    });
    expect(stale).toEqual({ ok: false, error: { category: "invalid-snapshot" } });

    const filtered = await useCase.execute({
      provider: makeProvider("early"),
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: {
        book: selectedBook,
        annotations: [
          createBookAnnotation({ inputIndex: 0 }),
          createBookAnnotation({ text: "A", inputIndex: 1 }),
        ],
      },
    });
    expect(filtered).toMatchObject({ ok: true, value: { annotationCount: 1 } });
  });

  it("reports both post-commit warnings without rolling back the write", async () => {
    const create = vi.fn(() => Promise.resolve());
    const save = vi.fn(() => Promise.reject(new Error("settings")));
    const open = vi.fn(() => Promise.reject(new Error("workspace")));
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings: { load: () => Promise.resolve({ defaultFolder: "Books" }), save },
      notes: { inspect: vi.fn(() => Promise.resolve({ kind: "missing" as const })), create, process: vi.fn(), open },
      render: vi.fn(() => "note"),
    });

    const result = await useCase.execute({
      provider: makeProvider("early"),
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: { book: selectedBook, annotations: [createBookAnnotation({ text: "A", inputIndex: 0 })] },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        path: "Books/Title.md",
        annotationCount: 1,
        warnings: [
          { category: "post-commit-warning", kind: "folder-persistence" },
          { category: "post-commit-warning", kind: "open-note" },
        ],
      },
    });
    expect(create).toHaveBeenCalledOnce();
  });

  it("persists the last folder only after a committed note write", async () => {
    const provider = makeProvider("early");
    const create = vi.fn(() => Promise.resolve());
    const save = vi.fn(() => Promise.resolve());
    const open = vi.fn(() => Promise.resolve());
    const useCase = createImportUseCase({
      credentials: { get: vi.fn(() => "credential") },
      settings: { load: settings.load, save },
      notes: { inspect: vi.fn(() => Promise.resolve({ kind: "missing" as const })), create, process: vi.fn(), open },
      render: vi.fn(() => "note"),
    });

    const result = await useCase.execute({
      provider,
      book: selectedBook,
      path: "Books/Title.md",
      confirmed: true,
      snapshot: { book: selectedBook, annotations: [createBookAnnotation({ text: "A", inputIndex: 0 })] },
    });

    expect(result).toMatchObject({ ok: true });
    expect(create).toHaveBeenCalledBefore(save);
    expect(save).toHaveBeenCalledWith({ defaultFolder: "Books", lastFolder: "Books" });
    expect(open).toHaveBeenCalledWith("Books/Title.md");
  });
});
