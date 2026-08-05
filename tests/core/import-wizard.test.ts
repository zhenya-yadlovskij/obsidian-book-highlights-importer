import { describe, expect, it, vi } from "vitest";

import type { ImportUseCase } from "../../src/core/import";
import { createImportWizardController, type ImportWizardController } from "../../src/core/import-wizard";
import { createBookAnnotation, createImportSnapshot, createProviderBook } from "../../src/core/models";
import type { ImportSnapshot, ProviderBook } from "../../src/core/models";
import type { ImportSettings, ReadingProviderPort } from "../../src/core/ports";
import { createProviderRegistry } from "../../src/core/registry";

const provider = (id: string, annotationFetch: "early" | "deferred" = "early"): ReadingProviderPort => ({
  id,
  displayName: id === "first" ? "First Provider" : "Second Provider",
  annotationFetch,
  testCredential: vi.fn(),
  listBooks: vi.fn(),
  fetchAnnotations: vi.fn(),
});

const book = (providerId: string, bookId: string, status = "finished"): ProviderBook => createProviderBook({
  providerId,
  bookId,
  title: bookId === "dune" ? "Dune" : "Foundation",
  authors: [bookId === "dune" ? "Frank Herbert" : "Isaac Asimov"],
  status,
});

const snapshot = (selectedBook: ProviderBook, count = 1): ImportSnapshot => createImportSnapshot({
  book: selectedBook,
  annotations: Array.from({ length: count }, (_, inputIndex) => createBookAnnotation({
    text: `Highlight ${String(inputIndex + 1)}`,
    inputIndex,
  })),
});

const loaded = (books: readonly ProviderBook[]): ReturnType<ImportUseCase["loadLibrary"]> =>
  Promise.resolve({ ok: true, value: books });

const prepared = (value: ImportSnapshot | undefined): ReturnType<ImportUseCase["prepareSnapshot"]> =>
  Promise.resolve({ ok: true, value });

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

interface ControllerFixture {
  readonly controller: ImportWizardController;
  readonly imports: Pick<ImportUseCase, "loadLibrary" | "prepareSnapshot" | "execute">;
}

const makeController = (options: {
  readonly providers?: readonly ReadingProviderPort[];
  readonly configured?: readonly string[];
  readonly settings?: ImportSettings;
  readonly loadSettings?: () => Promise<ImportSettings>;
  readonly loadLibrary?: ImportUseCase["loadLibrary"];
  readonly prepareSnapshot?: ImportUseCase["prepareSnapshot"];
  readonly execute?: ImportUseCase["execute"];
  readonly openNote?: (path: string) => Promise<void>;
  readonly onCancel?: () => void;
}): ControllerFixture => {
  const providers = options.providers ?? [provider("first")];
  const imports = {
    loadLibrary: options.loadLibrary ?? vi.fn(() => Promise.resolve({ ok: true as const, value: [] })),
    prepareSnapshot: options.prepareSnapshot ?? vi.fn(() => Promise.resolve({ ok: true as const, value: undefined })),
    execute: options.execute ?? vi.fn(() => Promise.resolve({
      ok: true as const,
      value: { path: "Books/Dune.md", annotationCount: 1, warnings: [] },
    })),
  };
  const controller = createImportWizardController({
    registry: createProviderRegistry(providers),
    credentials: { get: (providerId): string | null => (options.configured ?? ["first"]).includes(providerId) ? "configured" : null },
    settings: {
      load: options.loadSettings ?? ((): Promise<ImportSettings> =>
        Promise.resolve(options.settings ?? { defaultFolder: "Books" })),
    },
    imports,
    openNote: options.openNote ?? vi.fn(() => Promise.resolve()),
    ...(options.onCancel === undefined ? {} : { onCancel: options.onCancel }),
  });
  return { controller, imports };
};

describe("import wizard controller", () => {
  it("lists configuration status and blocks an unconfigured provider before library access", async () => {
    const first = provider("first");
    const second = provider("second");
    const { controller, imports } = makeController({ providers: [first, second], configured: ["first"] });

    expect(controller.getState()).toMatchObject({
      kind: "provider",
      providers: [
        { id: "first", displayName: "First Provider", configured: true },
        { id: "second", displayName: "Second Provider", configured: false },
      ],
    });

    await controller.selectProvider("second");

    expect(controller.getState()).toMatchObject({
      kind: "error",
      code: "missing-credential",
      message: "Configure this provider in Book Highlights Importer settings before importing.",
      canRetry: false,
    });
    expect(imports.loadLibrary).not.toHaveBeenCalled();
  });

  it("groups, searches, and retains exactly one selected library book", async () => {
    const books = [book("first", "foundation", "finished"), book("first", "dune", "reading")];
    const { controller } = makeController({
      loadLibrary: vi.fn(() => loaded(books)),
      prepareSnapshot: vi.fn((_provider: ReadingProviderPort, selectedBook: ProviderBook) => prepared(snapshot(selectedBook))),
    });

    await controller.selectProvider("first");
    expect(controller.getState()).toMatchObject({
      kind: "book",
      groups: [
        { key: "in-progress", books: [{ bookId: "dune" }] },
        { key: "finished", books: [{ bookId: "foundation" }] },
      ],
    });

    controller.search("herbert");
    expect(controller.getState()).toMatchObject({
      kind: "book",
      query: "herbert",
      groups: [{ key: "in-progress", books: [{ bookId: "dune" }] }],
    });

    await controller.selectBook("dune");
    expect(controller.getState()).toMatchObject({ kind: "destination", book: { bookId: "dune" } });
  });

  it("reports an empty library and prevents book selection", async () => {
    const { controller, imports } = makeController({
      loadLibrary: vi.fn(() => loaded([])),
    });

    await controller.selectProvider("first");

    expect(controller.getState()).toMatchObject({
      kind: "book",
      groups: [],
      message: "No books are available from this provider.",
    });
    await controller.selectBook("missing");
    expect(imports.prepareSnapshot).not.toHaveBeenCalled();
  });

  it("reprepares annotations when a same-provider reload changes selected-book metadata", async () => {
    const originalBook = createProviderBook({
      providerId: "first",
      bookId: "dune",
      title: "Dune",
      authors: ["Frank Herbert"],
      status: "finished",
    });
    const refreshedBook = createProviderBook({
      providerId: "first",
      bookId: "dune",
      title: "Dune: Revised Edition",
      authors: ["Frank Herbert"],
      status: "in-progress",
    });
    const loadLibrary = vi.fn<ImportUseCase["loadLibrary"]>()
      .mockResolvedValueOnce({ ok: true, value: [originalBook] })
      .mockResolvedValueOnce({ ok: true, value: [refreshedBook] });
    const prepareSnapshot = vi.fn<ImportUseCase["prepareSnapshot"]>((_provider, selectedBook) =>
      prepared(snapshot(selectedBook)));
    const { controller } = makeController({ loadLibrary, prepareSnapshot });

    await controller.selectProvider("first");
    await controller.selectBook("dune");
    expect(controller.getState()).toMatchObject({ kind: "destination", filename: "Frank Herbert - Dune.md" });
    controller.back();
    controller.back();

    await controller.selectProvider("first");
    await controller.selectBook("dune");

    expect(prepareSnapshot).toHaveBeenCalledTimes(2);
    expect(prepareSnapshot.mock.calls[1]?.[1]).toBe(refreshedBook);
    expect(controller.getState()).toMatchObject({
      kind: "destination",
      book: { title: "Dune: Revised Edition", status: "in-progress" },
      filename: "Frank Herbert - Dune - Revised Edition.md",
    });
  });

  it("discards a stale library response after the provider identity changes", async () => {
    const firstResult = deferred<Awaited<ReturnType<ImportUseCase["loadLibrary"]>>>();
    const secondResult = deferred<Awaited<ReturnType<ImportUseCase["loadLibrary"]>>>();
    const first = provider("first");
    const second = provider("second");
    const loadLibrary = vi.fn((selectedProvider: ReadingProviderPort) =>
      selectedProvider.id === "first" ? firstResult.promise : secondResult.promise);
    const { controller } = makeController({ providers: [first, second], configured: ["first", "second"], loadLibrary });

    const firstLoad = controller.selectProvider("first");
    const secondLoad = controller.selectProvider("second");
    firstResult.resolve({ ok: true, value: [book("first", "dune")] });
    await firstLoad;
    expect(controller.getState()).toMatchObject({ kind: "loading", operation: "library", providerId: "second" });

    secondResult.resolve({ ok: true, value: [book("second", "foundation")] });
    await secondLoad;
    expect(controller.getState()).toMatchObject({ kind: "book", providerId: "second" });
  });

  it("invalidates a pending library response when the replacement provider is unconfigured", async () => {
    const firstResult = deferred<Awaited<ReturnType<ImportUseCase["loadLibrary"]>>>();
    const first = provider("first");
    const second = provider("second");
    const loadLibrary = vi.fn<ImportUseCase["loadLibrary"]>(() => firstResult.promise);
    const { controller } = makeController({ providers: [first, second], configured: ["first"], loadLibrary });

    const firstLoad = controller.selectProvider("first");
    await controller.selectProvider("second");
    expect(controller.getState()).toMatchObject({ kind: "error", code: "missing-credential" });

    firstResult.resolve({ ok: true, value: [book("first", "dune")] });
    await firstLoad;
    expect(controller.getState()).toMatchObject({ kind: "error", code: "missing-credential" });
    expect(loadLibrary).toHaveBeenCalledOnce();
  });

  it("discards a pending library response after cancellation", async () => {
    const libraryResult = deferred<Awaited<ReturnType<ImportUseCase["loadLibrary"]>>>();
    const { controller } = makeController({
      loadLibrary: vi.fn(() => libraryResult.promise),
    });

    const loading = controller.selectProvider("first");
    controller.cancel();
    libraryResult.resolve({ ok: true, value: [book("first", "dune")] });
    await loading;

    expect(controller.getState()).toEqual({ kind: "cancelled" });
  });

  it("discards stale annotation responses after book change, Back, and cancel", async () => {
    const duneResult = deferred<Awaited<ReturnType<ImportUseCase["prepareSnapshot"]>>>();
    const foundationResult = deferred<Awaited<ReturnType<ImportUseCase["prepareSnapshot"]>>>();
    const books = [book("first", "dune"), book("first", "foundation")];
    const duneBook = books[0];
    const foundationBook = books[1];
    if (duneBook === undefined || foundationBook === undefined) throw new Error("Missing book fixtures");
    const prepareSnapshot = vi.fn((_provider: ReadingProviderPort, selectedBook: ReturnType<typeof book>) =>
      selectedBook.bookId === "dune" ? duneResult.promise : foundationResult.promise);
    const onCancel = vi.fn();
    const { controller } = makeController({
      loadLibrary: vi.fn(() => loaded(books)),
      prepareSnapshot,
      onCancel,
    });
    await controller.selectProvider("first");

    const duneLoad = controller.selectBook("dune");
    const foundationLoad = controller.selectBook("foundation");
    duneResult.resolve({ ok: true, value: snapshot(duneBook) });
    await duneLoad;
    expect(controller.getState()).toMatchObject({ kind: "loading", operation: "annotations", bookId: "foundation" });

    controller.back();
    foundationResult.resolve({ ok: true, value: snapshot(foundationBook) });
    await foundationLoad;
    expect(controller.getState()).toMatchObject({ kind: "book", selectedBookId: "foundation" });

    const pendingAgain = deferred<Awaited<ReturnType<ImportUseCase["prepareSnapshot"]>>>();
    prepareSnapshot.mockReturnValueOnce(pendingAgain.promise);
    const pendingLoad = controller.selectBook("dune");
    controller.cancel();
    pendingAgain.resolve({ ok: true, value: snapshot(duneBook) });
    await pendingLoad;
    expect(controller.getState()).toEqual({ kind: "cancelled" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("blocks destination work for an empty early snapshot and shows a non-empty count", async () => {
    const selectedBook = book("first", "dune");
    const settingsLoad = vi.fn(() => Promise.resolve({ defaultFolder: "Books" }));
    const prepareSnapshot = vi.fn<ImportUseCase["prepareSnapshot"]>()
      .mockResolvedValueOnce({ ok: true, value: snapshot(selectedBook, 0) })
      .mockResolvedValueOnce({ ok: true, value: snapshot(selectedBook, 2) });
    const controller = createImportWizardController({
      registry: createProviderRegistry([provider("first")]),
      credentials: { get: () => "configured" },
      settings: { load: settingsLoad },
      imports: {
        loadLibrary: () => loaded([selectedBook]),
        prepareSnapshot,
        execute: vi.fn(),
      },
      openNote: vi.fn(() => Promise.resolve()),
    });
    await controller.selectProvider("first");

    await controller.selectBook("dune");
    expect(controller.getState()).toMatchObject({ kind: "error", code: "empty-snapshot", canRetry: false });
    expect(settingsLoad).not.toHaveBeenCalled();

    controller.back();
    await controller.selectBook("dune");
    expect(controller.getState()).toMatchObject({ kind: "destination", annotationCount: 2 });
  });

  it("discards pending destination settings after Back", async () => {
    const selectedBook = book("first", "dune");
    const settingsResult = deferred<ImportSettings>();
    const { controller } = makeController({
      loadLibrary: vi.fn(() => loaded([selectedBook])),
      prepareSnapshot: vi.fn(() => prepared(snapshot(selectedBook))),
      loadSettings: () => settingsResult.promise,
    });
    await controller.selectProvider("first");

    const loading = controller.selectBook("dune");
    await Promise.resolve();
    expect(controller.getState()).toMatchObject({ kind: "loading", operation: "destination" });
    controller.back();
    settingsResult.resolve({ defaultFolder: "Stale" });
    await loading;

    expect(controller.getState()).toMatchObject({ kind: "book", selectedBookId: "dune" });
  });

  it("uses destination settings, sanitizes edits, and imports directly", async () => {
    const selectedBook = book("first", "dune");
    const execute = vi.fn<ImportUseCase["execute"]>(() => Promise.resolve({
      ok: true as const,
      value: { path: "Archive/Dune - Part One.md", annotationCount: 2, warnings: [] },
    }));
    const { controller } = makeController({
      settings: { defaultFolder: "Books", lastFolder: "Archive" },
      loadLibrary: vi.fn(() => loaded([selectedBook])),
      prepareSnapshot: vi.fn(() => prepared(snapshot(selectedBook, 2))),
      execute,
    });
    await controller.selectProvider("first");
    await controller.selectBook("dune");

    expect(controller.getState()).toMatchObject({
      kind: "destination",
      folder: "Archive",
      filename: "Frank Herbert - Dune.md",
    });
    controller.updateDestination("Archive", "Dune: Part / One");
    const importing = controller.import();
    expect(controller.getState()).toMatchObject({ kind: "importing", path: "Archive/Dune - Part - One.md" });
    await importing;
    const request = execute.mock.calls[0]?.[0];
    expect(request?.provider.id).toBe("first");
    expect(request?.book.bookId).toBe("dune");
    expect(request?.path).toBe("Archive/Dune - Part - One.md");
    expect(request?.snapshot?.annotations).toHaveLength(2);
  });

  it("blocks an invalid destination before starting the import", async () => {
    const selectedBook = book("first", "dune");
    const execute = vi.fn<ImportUseCase["execute"]>();
    const { controller } = makeController({
      loadLibrary: vi.fn(() => loaded([selectedBook])),
      prepareSnapshot: vi.fn(() => prepared(snapshot(selectedBook))),
      execute,
    });
    await controller.selectProvider("first");
    await controller.selectBook("dune");

    controller.updateDestination("../Unsafe", "Dune.md");
    await controller.import();

    expect(controller.getState()).toMatchObject({ kind: "error", code: "unsafe-destination" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("retains the sanitized destination when a direct import fails and is retried", async () => {
    const selectedBook = book("first", "dune");
    const execute = vi.fn<ImportUseCase["execute"]>()
      .mockResolvedValueOnce({ ok: false, error: { category: "provider-unavailable", providerId: "first" } })
      .mockResolvedValueOnce({ ok: true, value: { path: "Books/Dune - Notes.md", annotationCount: 1, warnings: [] } });
    const { controller } = makeController({
      loadLibrary: vi.fn(() => loaded([selectedBook])),
      prepareSnapshot: vi.fn(() => prepared(snapshot(selectedBook))),
      execute,
    });
    await controller.selectProvider("first");
    await controller.selectBook("dune");

    controller.updateDestination("Books", "Dune: Notes");
    await controller.import();
    expect(controller.getState()).toMatchObject({ kind: "error", canRetry: true });

    controller.back();
    expect(controller.getState()).toMatchObject({ kind: "destination", filename: "Dune - Notes.md" });
    await controller.import();
    expect(controller.getState()).toMatchObject({ kind: "complete" });
  });

  it("fetches deferred annotations only after the destination import action", async () => {
    const selectedBook = book("first", "dune");
    const deferredProvider = provider("first", "deferred");
    const prepareSnapshot = vi.fn(() => Promise.resolve({ ok: true as const, value: undefined }));
    const execute = vi.fn(() => Promise.resolve({
      ok: true as const,
      value: { path: "Books/Frank Herbert - Dune.md", annotationCount: 3, warnings: [] },
    }));
    const { controller } = makeController({
      providers: [deferredProvider],
      loadLibrary: vi.fn(() => loaded([selectedBook])),
      prepareSnapshot,
      execute,
    });

    await controller.selectProvider("first");
    await controller.selectBook("dune");
    const importing = controller.import();
    expect(controller.getState()).toMatchObject({ kind: "importing" });
    await importing;
    expect(execute).toHaveBeenCalledOnce();
    expect(controller.getState()).toMatchObject({ kind: "complete", annotationCount: 3 });
  });

  it("maps provider failures to fixed safe guidance and retries the failed operation", async () => {
    const secret = "credential-that-must-not-appear";
    const selectedBook = book("first", "dune");
    const loadLibrary = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { category: "authentication", providerId: "first", detail: secret } })
      .mockResolvedValueOnce({ ok: true, value: [selectedBook] });
    const { controller } = makeController({ loadLibrary });

    await controller.selectProvider("first");
    expect(controller.getState()).toMatchObject({
      kind: "error",
      code: "authentication",
      message: "Authentication failed. Replace or test the provider credential in settings, then retry.",
      canRetry: true,
    });
    expect(JSON.stringify(controller.getState())).not.toContain(secret);

    await controller.retry();
    expect(loadLibrary).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({ kind: "book", providerId: "first" });
  });

  it("returns destination conflicts for correction and preserves committed success warnings", async () => {
    const selectedBook = book("first", "dune");
    const execute = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { category: "destination-conflict", detail: "unsafe provider detail" } })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          path: "Books/Frank Herbert - Dune.md",
          annotationCount: 2,
          warnings: [
            { category: "post-commit-warning", kind: "folder-persistence" },
            { category: "post-commit-warning", kind: "open-note" },
          ],
        },
      });
    const { controller } = makeController({
      loadLibrary: vi.fn(() => loaded([selectedBook])),
      prepareSnapshot: vi.fn(() => prepared(snapshot(selectedBook, 2))),
      execute,
    });
    await controller.selectProvider("first");
    await controller.selectBook("dune");
    await controller.import();
    expect(controller.getState()).toMatchObject({
      kind: "error",
      code: "destination-conflict",
      message: "This destination cannot be updated safely. Choose a different filename.",
      canRetry: false,
    });
    expect(JSON.stringify(controller.getState())).not.toContain("unsafe provider detail");

    controller.back();
    expect(controller.getState()).toMatchObject({ kind: "destination" });
    await controller.import();
    expect(controller.getState()).toMatchObject({
      kind: "complete",
      annotationCount: 2,
      warnings: [
        "The note was imported, but the destination folder was not remembered.",
        "The note was imported, but Obsidian could not open it. Open it from the vault or retry opening it.",
      ],
    });
  });

  it("retries when the destination folder cannot be prepared", async () => {
    const selectedBook = book("first", "dune");
    const execute = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { category: "destination-unavailable" as const } })
      .mockResolvedValueOnce({
        ok: true as const,
        value: { path: "Books/Dune.md", annotationCount: 1, warnings: [] },
      });
    const { controller } = makeController({
      loadLibrary: vi.fn(() => loaded([selectedBook])),
      prepareSnapshot: vi.fn(() => prepared(snapshot(selectedBook))),
      execute,
    });

    await controller.selectProvider("first");
    await controller.selectBook("dune");
    await controller.import();

    expect(controller.getState()).toMatchObject({
      kind: "error",
      code: "destination-unavailable",
      message: "The destination folder could not be prepared. Retry the import or choose another folder.",
      canRetry: true,
    });

    await controller.retry();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({ kind: "complete", path: "Books/Dune.md" });
  });

  it("retries only opening the committed note and retains completion when reopening fails", async () => {
    const secret = "credential-that-must-not-appear";
    const selectedBook = book("first", "dune");
    const execute = vi.fn<ImportUseCase["execute"]>(() => Promise.resolve({
      ok: true,
      value: {
        path: "Books/Frank Herbert - Dune.md",
        annotationCount: 2,
        warnings: [{ category: "post-commit-warning", kind: "open-note" }],
      },
    }));
    const openNote = vi.fn<(path: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error(`Workspace failed with ${secret}`))
      .mockResolvedValueOnce(undefined);
    const { controller } = makeController({
      loadLibrary: vi.fn(() => loaded([selectedBook])),
      prepareSnapshot: vi.fn(() => prepared(snapshot(selectedBook, 2))),
      execute,
      openNote,
    });
    await controller.selectProvider("first");
    await controller.selectBook("dune");
    await controller.import();

    expect(controller.getState()).toMatchObject({
      kind: "complete",
      path: "Books/Frank Herbert - Dune.md",
      annotationCount: 2,
      canRetryOpen: true,
    });
    await controller.retryOpen();
    expect(controller.getState()).toMatchObject({
      kind: "complete",
      annotationCount: 2,
      canRetryOpen: true,
      warnings: ["The note was imported, but Obsidian could not open it. Open it from the vault or retry opening it."],
    });
    expect(JSON.stringify(controller.getState())).not.toContain(secret);
    expect(openNote).toHaveBeenCalledWith("Books/Frank Herbert - Dune.md");
    expect(execute).toHaveBeenCalledOnce();

    await controller.retryOpen();
    expect(controller.getState()).toMatchObject({
      kind: "complete",
      annotationCount: 2,
      warnings: [],
      canRetryOpen: false,
    });
    expect(openNote).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("does not offer cancellation once the atomic import has started", async () => {
    const selectedBook = book("first", "dune");
    const result = deferred<Awaited<ReturnType<ImportUseCase["execute"]>>>();
    const onCancel = vi.fn();
    const { controller } = makeController({
      loadLibrary: vi.fn(() => loaded([selectedBook])),
      prepareSnapshot: vi.fn(() => prepared(snapshot(selectedBook))),
      execute: vi.fn(() => result.promise),
      onCancel,
    });
    await controller.selectProvider("first");
    await controller.selectBook("dune");
    const importing = controller.import();
    expect(controller.getState()).toMatchObject({ kind: "importing" });
    controller.cancel();
    await controller.selectProvider("first");
    await controller.selectBook("dune");
    expect(controller.getState()).toMatchObject({ kind: "importing" });
    expect(onCancel).not.toHaveBeenCalled();

    result.resolve({ ok: true, value: { path: "Books/Dune.md", annotationCount: 1, warnings: [] } });
    await importing;
  });
});
