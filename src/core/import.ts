import { filterImportableAnnotations } from "./annotations";
import { createImportSnapshot, type ImportSnapshot, type ProviderBook } from "./models";
import type {
  CredentialStorePort,
  ImportError,
  ImportResult,
  ImportSettings,
  NoteRepositoryPort,
  PreparationResult,
  ReadingProviderPort,
  Result,
  SettingsRepositoryPort,
} from "./ports";
import type { PostCommitWarning, SnapshotResult } from "./results";
import { failure, ok } from "./results";
import { createManagedNoteService, type ManagedNoteError } from "../notes/service";

export interface ImportDependencies {
  readonly credentials: Pick<CredentialStorePort, "get">;
  readonly settings: SettingsRepositoryPort;
  readonly notes: NoteRepositoryPort;
  readonly render?: (snapshot: ImportSnapshot) => string;
}

export interface ExecuteRequest {
  readonly provider: ReadingProviderPort;
  readonly book: ProviderBook;
  readonly path: string;
  readonly confirmed: boolean;
  readonly snapshot?: ImportSnapshot;
  readonly isActive?: () => boolean;
}

export interface ImportUseCase {
  readonly testCredential: (provider: ReadingProviderPort) => Promise<Result<void, ImportError>>;
  readonly loadLibrary: (provider: ReadingProviderPort) => Promise<Result<readonly ProviderBook[], ImportError>>;
  readonly fetchAnnotations: (provider: ReadingProviderPort, book: ProviderBook) => Promise<SnapshotResult>;
  readonly prepareSnapshot: (provider: ReadingProviderPort, book: ProviderBook) => Promise<PreparationResult>;
  readonly execute: (request: ExecuteRequest) => Promise<ImportResult>;
}

const providerError = (provider: ReadingProviderPort, category: "authentication" | "provider-unavailable" | "incomplete-data"): ImportError => ({
  category,
  providerId: provider.id,
});

const toImportError = (provider: ReadingProviderPort, category: "authentication" | "provider-unavailable" | "incomplete-data"): ImportError =>
  providerError(provider, category);

const currentCredential = (
  credentials: Pick<CredentialStorePort, "get">,
  provider: ReadingProviderPort,
): Result<string, ImportError> => {
  const credential = credentials.get(provider.id);
  return credential === null || credential.trim() === ""
    ? failure({ category: "missing-credential", providerId: provider.id })
    : ok(credential);
};

const folderFromPath = (path: string): string => {
  const separator = path.lastIndexOf("/");
  return separator === -1 ? "" : path.slice(0, separator);
};

const sameBookState = (left: ProviderBook, right: ProviderBook): boolean =>
  left.providerId === right.providerId &&
  left.bookId === right.bookId &&
  left.title === right.title &&
  left.authors.length === right.authors.length &&
  left.authors.every((author, index) => author === right.authors[index]) &&
  left.status === right.status &&
  left.progress === right.progress &&
  left.sourceUrl === right.sourceUrl;

const toManagedNoteImportError = (error: ManagedNoteError): ImportError => ({ category: error.category });

export const createImportUseCase = (dependencies: ImportDependencies): ImportUseCase => {
  const managedNotes = createManagedNoteService({
    notes: dependencies.notes,
    ...(dependencies.render === undefined ? {} : { render: dependencies.render }),
  });

  const testCredential = async (provider: ReadingProviderPort): Promise<Result<void, ImportError>> => {
    const credential = currentCredential(dependencies.credentials, provider);
    if (!credential.ok) return credential;
    const result = await provider.testCredential(credential.value);
    if (result.ok) return result;
    return failure(toImportError(provider, result.error.category));
  };

  const loadLibrary = async (provider: ReadingProviderPort): Promise<Result<readonly ProviderBook[], ImportError>> => {
    const credential = currentCredential(dependencies.credentials, provider);
    if (!credential.ok) return credential;
    const result = await provider.listBooks(credential.value);
    if (result.ok) return result;
    return failure(toImportError(provider, result.error.category));
  };

  const fetchAnnotations = async (provider: ReadingProviderPort, book: ProviderBook): Promise<SnapshotResult> => {
    const credential = currentCredential(dependencies.credentials, provider);
    if (!credential.ok) return credential;
    const result = await provider.fetchAnnotations(credential.value, book);
    if (!result.ok) return failure(toImportError(provider, result.error.category));
    return ok(createImportSnapshot({ book, annotations: filterImportableAnnotations(result.value) }));
  };

  const prepareSnapshot = async (provider: ReadingProviderPort, book: ProviderBook): Promise<PreparationResult> => {
    if (provider.annotationFetch === "deferred") return ok(undefined);
    return fetchAnnotations(provider, book);
  };

  const validateSuppliedSnapshot = (
    provider: ReadingProviderPort,
    book: ProviderBook,
    supplied: ImportSnapshot,
  ): SnapshotResult => {
    const credential = currentCredential(dependencies.credentials, provider);
    if (!credential.ok) return credential;
    const snapshot = createImportSnapshot({
      book: supplied.book,
      annotations: filterImportableAnnotations(supplied.annotations),
      ...(supplied.fetchedAt === undefined ? {} : { fetchedAt: supplied.fetchedAt }),
    });
    if (!sameBookState(snapshot.book, book) || snapshot.book.providerId !== provider.id) {
      return failure({ category: "invalid-snapshot" });
    }
    return ok(snapshot);
  };

  const execute = async (request: ExecuteRequest): Promise<ImportResult> => {
    if (!request.confirmed) return failure({ category: "confirmation-required" });
    if (request.isActive?.() === false) return failure({ category: "cancelled" });

    let snapshot: ImportSnapshot;
    if (request.snapshot !== undefined) {
      const supplied = validateSuppliedSnapshot(request.provider, request.book, request.snapshot);
      if (!supplied.ok) return supplied;
      snapshot = supplied.value;
    } else {
      const prepared = await prepareSnapshot(request.provider, request.book);
      if (request.isActive?.() === false) return failure({ category: "cancelled" });
      if (!prepared.ok) return prepared;
      if (prepared.value === undefined) {
        const fetched = await fetchAnnotations(request.provider, request.book);
        if (request.isActive?.() === false) return failure({ category: "cancelled" });
        if (!fetched.ok) return fetched;
        snapshot = fetched.value;
      } else {
        snapshot = prepared.value;
      }
    }
    if (snapshot.annotations.length === 0) return failure({ category: "empty-snapshot" });
    if (request.isActive?.() === false) return failure({ category: "cancelled" });

    const note = await managedNotes.write(request.path, snapshot, request.isActive);
    if (!note.ok) return failure(toManagedNoteImportError(note.error));

    const warnings: PostCommitWarning[] = [];
    try {
      const settings = await dependencies.settings.load();
      const updated: ImportSettings = { ...settings, lastFolder: folderFromPath(request.path) };
      await dependencies.settings.save(updated);
    } catch {
      warnings.push({ category: "post-commit-warning", kind: "folder-persistence" });
    }
    try {
      await dependencies.notes.open(request.path);
    } catch {
      warnings.push({ category: "post-commit-warning", kind: "open-note" });
    }

    return ok({ path: request.path, annotationCount: snapshot.annotations.length, warnings });
  };

  return { testCredential, loadLibrary, fetchAnnotations, prepareSnapshot, execute };
};
