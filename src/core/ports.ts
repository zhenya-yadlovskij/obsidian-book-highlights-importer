import type { BookAnnotation, ProviderBook } from "./models";
import type { ProviderResult } from "./results";
export { failure, ok } from "./results";
export type {
  ImportError,
  ImportResult,
  PreparationResult,
  PostCommitWarning,
  ProviderError,
  ProviderResult,
  Result,
  SnapshotResult,
} from "./results";

export interface ReadingProviderPort {
  readonly id: string;
  readonly displayName: string;
  readonly annotationFetch: "early" | "deferred";
  readonly testCredential: (credential: string) => Promise<ProviderResult<void>>;
  readonly listBooks: (credential: string) => Promise<ProviderResult<readonly ProviderBook[]>>;
  readonly fetchAnnotations: (credential: string, book: ProviderBook) => Promise<ProviderResult<readonly BookAnnotation[]>>;
}

export interface CredentialStorePort {
  readonly get: (providerId: string) => string | null;
  readonly set: (providerId: string, credential: string) => void;
  readonly clear: (providerId: string) => void;
}

export interface ImportSettings {
  readonly defaultFolder: string;
  readonly lastFolder?: string;
}

export interface SettingsRepositoryPort {
  readonly load: () => Promise<ImportSettings>;
  readonly update: (change: (current: ImportSettings) => ImportSettings) => Promise<ImportSettings>;
}

export type DestinationState =
  | { readonly kind: "missing" }
  | { readonly kind: "managed" }
  | { readonly kind: "conflict" };

export interface NoteRepositoryPort {
  readonly inspect: (path: string) => Promise<DestinationState>;
  readonly ensureFolder: (folder: string) => Promise<void>;
  readonly create: (path: string, content: string) => Promise<void>;
  readonly process: (path: string, update: (current: string) => string) => Promise<void>;
  readonly open: (path: string) => Promise<void>;
}

export type { ImportSuccess } from "./results";
