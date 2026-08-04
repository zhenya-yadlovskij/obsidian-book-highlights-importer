import { chooseDestinationFolder, createDestination, sanitizeEditedFilename, sanitizeFilename } from "./destination";
import type { ImportUseCase } from "./import";
import { groupBooks, searchBooks, type LibraryGroup } from "./library";
import type { ImportSnapshot, ProviderBook } from "./models";
import type { CredentialStorePort, ImportError, SettingsRepositoryPort } from "./ports";
import type { ProviderRegistry } from "./registry";

export interface WizardProviderOption {
  readonly id: string;
  readonly displayName: string;
  readonly configured: boolean;
}

export type WizardErrorCode = ImportError["category"] | "unsafe-destination" | "settings-unavailable" | "unexpected";

export type ImportWizardState =
  | {
      readonly kind: "provider";
      readonly providers: readonly WizardProviderOption[];
      readonly selectedProviderId: string | undefined;
    }
  | {
      readonly kind: "loading";
      readonly operation: "library" | "annotations" | "destination";
      readonly providerId: string;
      readonly bookId: string | undefined;
    }
  | {
      readonly kind: "book";
      readonly providerId: string;
      readonly groups: readonly LibraryGroup[];
      readonly query: string;
      readonly selectedBookId: string | undefined;
      readonly message: string | undefined;
    }
  | {
      readonly kind: "destination";
      readonly providerId: string;
      readonly book: ProviderBook;
      readonly folder: string;
      readonly filename: string;
      readonly annotationCount: number | undefined;
    }
  | {
      readonly kind: "importing";
      readonly providerId: string;
      readonly bookId: string;
      readonly path: string;
    }
  | {
      readonly kind: "error";
      readonly step: "provider" | "book" | "destination";
      readonly code: WizardErrorCode;
      readonly message: string;
      readonly canRetry: boolean;
    }
  | {
      readonly kind: "complete";
      readonly path: string;
      readonly annotationCount: number;
      readonly warnings: readonly string[];
      readonly canRetryOpen: boolean;
    }
  | { readonly kind: "cancelled" };

export interface ImportWizardDependencies {
  readonly registry: ProviderRegistry;
  readonly credentials: Pick<CredentialStorePort, "get">;
  readonly settings: Pick<SettingsRepositoryPort, "load">;
  readonly imports: Pick<ImportUseCase, "loadLibrary" | "prepareSnapshot" | "execute">;
  readonly openNote: (path: string) => Promise<void>;
  readonly onStateChange?: (state: ImportWizardState) => void;
  readonly onCancel?: () => void;
}

export interface ImportWizardController {
  readonly getState: () => ImportWizardState;
  readonly selectProvider: (providerId: string) => Promise<void>;
  readonly search: (query: string) => void;
  readonly selectBook: (bookId: string) => Promise<void>;
  readonly updateDestination: (folder: string, filename: string) => void;
  readonly import: () => Promise<void>;
  readonly back: () => void;
  readonly retry: () => Promise<void>;
  readonly retryOpen: () => Promise<void>;
  readonly cancel: () => void;
  readonly cancelForUnload: () => void;
}

interface DestinationSelection {
  readonly folder: string;
  readonly filename: string;
}

const errorMessage = (category: WizardErrorCode): string => {
  switch (category) {
    case "missing-credential":
      return "Configure this provider in Book Highlights Importer settings before importing.";
    case "authentication":
      return "Authentication failed. Replace or test the provider credential in settings, then retry.";
    case "provider-unavailable":
      return "The provider is unavailable. Check your connection and retry.";
    case "incomplete-data":
      return "The provider returned incomplete data. Retry to avoid importing a partial result.";
    case "empty-snapshot":
      return "This book has no importable annotations.";
    case "destination-conflict":
      return "This destination cannot be updated safely. Choose a different filename.";
    case "unsafe-destination":
      return "Choose a vault folder and valid filename.";
    case "settings-unavailable":
      return "Import settings could not be loaded. Retry or cancel.";
    case "invalid-snapshot":
      return "The selected book changed. Go back and prepare the import again.";
    case "cancelled":
      return "The import was cancelled before the note update began.";
    case "provider-not-registered":
      return "This provider is no longer available. Choose another provider.";
    case "renderer-unavailable":
    case "rendering-failed":
      return "The note could not be prepared safely. No note was changed.";
    case "unexpected":
      return "The import could not be completed. Retry or cancel.";
  }
};

const warningMessage = (kind: "folder-persistence" | "open-note"): string => kind === "folder-persistence"
  ? "The note was imported, but the destination folder was not remembered."
  : "The note was imported, but Obsidian could not open it. Open it from the vault or retry opening it.";

const sameBookMetadata = (left: ProviderBook, right: ProviderBook): boolean =>
  left.providerId === right.providerId &&
  left.bookId === right.bookId &&
  left.title === right.title &&
  left.authors.length === right.authors.length &&
  left.authors.every((author, index) => author === right.authors[index]) &&
  left.status === right.status &&
  left.progress === right.progress &&
  left.sourceUrl === right.sourceUrl;

export const createImportWizardController = (dependencies: ImportWizardDependencies): ImportWizardController => {
  let generation = 0;
  let selectedProviderId: string | undefined;
  let selectedBookId: string | undefined;
  let library: readonly ProviderBook[] = [];
  let groups: readonly LibraryGroup[] = [];
  let query = "";
  let selectedBook: ProviderBook | undefined;
  let preparedSnapshot: ImportSnapshot | undefined;
  let destination: DestinationSelection | undefined;
  let backState: ImportWizardState | undefined;
  let retryAction: (() => Promise<void>) | undefined;

  const providerOptions = (): readonly WizardProviderOption[] => dependencies.registry.all().map((provider) => {
    let configured = false;
    try {
      const credential = dependencies.credentials.get(provider.id);
      configured = credential !== null && credential.trim() !== "";
    } catch {
      // Configuration status is deliberately credential-safe.
    }
    return { id: provider.id, displayName: provider.displayName, configured };
  });

  const providerState = (): ImportWizardState => ({
    kind: "provider",
    providers: providerOptions(),
    selectedProviderId,
  });

  let state: ImportWizardState = providerState();

  const setState = (next: ImportWizardState): void => {
    state = next;
    dependencies.onStateChange?.(state);
  };

  const invalidate = (): number => {
    generation += 1;
    return generation;
  };

  const current = (requestGeneration: number, providerId: string, bookId?: string): boolean =>
    generation === requestGeneration &&
    selectedProviderId === providerId &&
    (bookId === undefined || selectedBookId === bookId);

  const bookState = (): ImportWizardState => ({
    kind: "book",
    providerId: selectedProviderId ?? "",
    groups: searchBooks(groups, query),
    query,
    selectedBookId,
    message: library.length === 0 ? "No books are available from this provider." : undefined,
  });

  const destinationState = (): Extract<ImportWizardState, { kind: "destination" }> | undefined => {
    if (selectedProviderId === undefined || selectedBook === undefined || destination === undefined) return undefined;
    return {
      kind: "destination",
      providerId: selectedProviderId,
      book: selectedBook,
      folder: destination.folder,
      filename: destination.filename,
      annotationCount: preparedSnapshot?.annotations.length,
    };
  };

  const showError = (
    code: WizardErrorCode,
    step: Extract<ImportWizardState, { kind: "error" }>["step"],
    canRetry: boolean,
    previous: ImportWizardState,
    retry?: () => Promise<void>,
  ): void => {
    backState = previous;
    retryAction = retry;
    setState({ kind: "error", step, code, message: errorMessage(code), canRetry });
  };

  const openDestination = async (requestGeneration: number, providerId: string, bookId: string): Promise<void> => {
    setState({ kind: "loading", operation: "destination", providerId, bookId });
    let settings: Awaited<ReturnType<typeof dependencies.settings.load>>;
    try {
      settings = await dependencies.settings.load();
    } catch {
      if (current(requestGeneration, providerId, bookId)) {
        showError("settings-unavailable", "destination", true, bookState(), async () => {
          await openDestination(invalidate(), providerId, bookId);
        });
      }
      return;
    }
    if (!current(requestGeneration, providerId, bookId) || selectedBook === undefined) return;

    destination = {
      folder: chooseDestinationFolder(settings),
      filename: sanitizeFilename(selectedBook.authors.join(", "), selectedBook.title),
    };
    const next = destinationState();
    if (next !== undefined) setState(next);
  };

  const prepareBook = async (bookId: string): Promise<void> => {
    if (state.kind === "importing") return;
    const providerId = selectedProviderId;
    if (providerId === undefined) return;
    const provider = dependencies.registry.get(providerId);
    const nextBook = library.find((candidate) => candidate.bookId === bookId && candidate.providerId === providerId);
    if (provider === undefined || nextBook === undefined) return;

    if (selectedBookId !== bookId) {
      preparedSnapshot = undefined;
      destination = undefined;
    }
    selectedBookId = bookId;
    selectedBook = nextBook;

    const requestGeneration = invalidate();
    setState({ kind: "loading", operation: "annotations", providerId, bookId });
    let result: Awaited<ReturnType<typeof dependencies.imports.prepareSnapshot>>;
    try {
      result = await dependencies.imports.prepareSnapshot(provider, nextBook);
    } catch {
      if (current(requestGeneration, providerId, bookId)) {
        showError("provider-unavailable", "book", true, bookState(), async () => {
          await prepareBook(bookId);
        });
      }
      return;
    }
    if (!current(requestGeneration, providerId, bookId)) return;
    if (!result.ok) {
      const canRetry = result.error.category !== "missing-credential";
      showError(result.error.category, "book", canRetry, bookState(), canRetry ? async (): Promise<void> => {
        await prepareBook(bookId);
      } : undefined);
      return;
    }
    if (result.value?.annotations.length === 0) {
      showError("empty-snapshot", "book", false, bookState());
      return;
    }

    preparedSnapshot = result.value;
    await openDestination(requestGeneration, providerId, bookId);
  };

  const loadProvider = async (providerId: string): Promise<void> => {
    if (state.kind === "importing") return;
    if (selectedProviderId !== providerId) {
      invalidate();
      selectedProviderId = providerId;
      selectedBookId = undefined;
      selectedBook = undefined;
      preparedSnapshot = undefined;
      destination = undefined;
    }
    const provider = dependencies.registry.get(providerId);
    if (provider === undefined) {
      showError("provider-not-registered", "provider", false, providerState());
      return;
    }

    let configured = false;
    try {
      const credential = dependencies.credentials.get(providerId);
      configured = credential !== null && credential.trim() !== "";
    } catch {
      // Treat inaccessible credentials as unavailable configuration.
    }
    if (!configured) {
      showError("missing-credential", "provider", false, providerState());
      return;
    }

    query = "";
    const requestGeneration = invalidate();
    setState({ kind: "loading", operation: "library", providerId, bookId: undefined });

    let result: Awaited<ReturnType<typeof dependencies.imports.loadLibrary>>;
    try {
      result = await dependencies.imports.loadLibrary(provider);
    } catch {
      if (current(requestGeneration, providerId)) {
        showError("provider-unavailable", "provider", true, providerState(), async () => {
          await loadProvider(providerId);
        });
      }
      return;
    }
    if (!current(requestGeneration, providerId)) return;
    if (!result.ok) {
      const canRetry = result.error.category !== "missing-credential";
      showError(result.error.category, "provider", canRetry, providerState(), canRetry ? async (): Promise<void> => {
        await loadProvider(providerId);
      } : undefined);
      return;
    }

    const previousSelectedBook = selectedBook;
    library = result.value;
    groups = groupBooks(library);
    if (selectedBookId !== undefined) {
      selectedBook = library.find((candidate) => candidate.bookId === selectedBookId && candidate.providerId === providerId);
      if (selectedBook === undefined) {
        selectedBookId = undefined;
        preparedSnapshot = undefined;
        destination = undefined;
      } else if (previousSelectedBook === undefined || !sameBookMetadata(previousSelectedBook, selectedBook)) {
        preparedSnapshot = undefined;
        destination = undefined;
      }
    }
    setState(bookState());
  };

  const startImport = async (): Promise<void> => {
    if (state.kind !== "destination" || selectedProviderId === undefined || selectedBook === undefined || destination === undefined) return;
    const book = selectedBook;
    const destinationStateAtStart = state;
    const filename = sanitizeEditedFilename(destination.filename);
    destination = { folder: destination.folder, filename };
    const path = createDestination(destination.folder, filename);
    if (!path.ok) {
      showError("unsafe-destination", "destination", false, destinationState() ?? destinationStateAtStart);
      return;
    }
    const validatedDestination = destinationState() ?? destinationStateAtStart;
    const provider = dependencies.registry.get(selectedProviderId);
    if (provider === undefined) {
      showError("provider-not-registered", "destination", false, validatedDestination);
      return;
    }

    const requestGeneration = invalidate();
    setState({
      kind: "importing",
      providerId: selectedProviderId,
      bookId: book.bookId,
      path: path.value,
    });

    let result: Awaited<ReturnType<typeof dependencies.imports.execute>>;
    try {
      result = await dependencies.imports.execute({
        provider,
        book,
        path: path.value,
        isActive: () => current(requestGeneration, provider.id, book.bookId),
        ...(preparedSnapshot === undefined ? {} : { snapshot: preparedSnapshot }),
      });
    } catch {
      if (current(requestGeneration, provider.id, book.bookId)) {
        showError("unexpected", "destination", true, validatedDestination, async () => {
          setState(validatedDestination);
          await startImport();
        });
      }
      return;
    }
    if (!current(requestGeneration, provider.id, book.bookId)) return;
    if (!result.ok) {
      if (result.error.category === "destination-conflict") {
        showError("destination-conflict", "destination", false, validatedDestination);
        return;
      }
      const retryable = result.error.category === "authentication" ||
        result.error.category === "provider-unavailable" ||
        result.error.category === "incomplete-data";
      showError(result.error.category, "destination", retryable, validatedDestination, retryable ? async (): Promise<void> => {
        setState(validatedDestination);
        await startImport();
      } : undefined);
      return;
    }

    setState({
      kind: "complete",
      path: result.value.path,
      annotationCount: result.value.annotationCount,
      warnings: result.value.warnings.map((warning) => warningMessage(warning.kind)),
      canRetryOpen: result.value.warnings.some((warning) => warning.kind === "open-note"),
    });
  };

  const cancel = (force: boolean): void => {
    if (state.kind === "complete" || state.kind === "cancelled" || (!force && state.kind === "importing")) return;
    invalidate();
    retryAction = undefined;
    setState({ kind: "cancelled" });
    dependencies.onCancel?.();
  };

  const controller: ImportWizardController = {
    getState: () => state,
    selectProvider: loadProvider,
    search: (nextQuery): void => {
      if (state.kind !== "book") return;
      query = nextQuery;
      setState(bookState());
    },
    selectBook: async (bookId): Promise<void> => {
      if (state.kind === "importing") return;
      const compatibleDestination = selectedBookId === bookId ? destinationState() : undefined;
      if (compatibleDestination !== undefined) {
        setState(compatibleDestination);
        return;
      }
      await prepareBook(bookId);
    },
    updateDestination: (folder, filename): void => {
      if (state.kind !== "destination") return;
      destination = { folder, filename };
      const next = destinationState();
      if (next !== undefined) setState(next);
    },
    import: startImport,
    back: (): void => {
      if (state.kind === "importing" || state.kind === "complete" || state.kind === "cancelled") return;
      invalidate();
      retryAction = undefined;
      if (state.kind === "error") {
        setState(backState ?? providerState());
        return;
      }
      if (state.kind === "provider") return;
      if (state.kind === "book") {
        setState(providerState());
        return;
      }
      if (state.kind === "destination") {
        setState(bookState());
        return;
      }
      setState(state.operation === "library" ? providerState() : bookState());
    },
    retry: async (): Promise<void> => {
      if (state.kind !== "error" || !state.canRetry || retryAction === undefined) return;
      const action = retryAction;
      invalidate();
      retryAction = undefined;
      await action();
    },
    retryOpen: async (): Promise<void> => {
      if (state.kind !== "complete" || !state.canRetryOpen) return;
      const completed = state;
      try {
        await dependencies.openNote(completed.path);
      } catch {
        if (state === completed) setState(completed);
        return;
      }
      if (state !== completed) return;
      setState({
        ...completed,
        warnings: completed.warnings.filter((warning) => warning !== warningMessage("open-note")),
        canRetryOpen: false,
      });
    },
    cancel: (): void => {
      cancel(false);
    },
    cancelForUnload: (): void => {
      cancel(true);
    },
  };

  return controller;
};
