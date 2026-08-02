import type { BookAnnotation, ImportSnapshot, ProviderBook } from "./models";

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type ProviderError =
  | { readonly category: "authentication"; readonly providerId: string }
  | { readonly category: "provider-unavailable"; readonly providerId: string }
  | { readonly category: "incomplete-data"; readonly providerId: string };

export type ProviderResult<T> = Result<T, ProviderError>;

export type PostCommitWarning =
  | { readonly category: "post-commit-warning"; readonly kind: "folder-persistence" }
  | { readonly category: "post-commit-warning"; readonly kind: "open-note" };

export type ImportError =
  | { readonly category: "missing-credential"; readonly providerId: string }
  | { readonly category: "authentication"; readonly providerId: string }
  | { readonly category: "provider-unavailable"; readonly providerId: string }
  | { readonly category: "incomplete-data"; readonly providerId: string }
  | { readonly category: "confirmation-required" }
  | { readonly category: "empty-snapshot" }
  | { readonly category: "invalid-snapshot" }
  | { readonly category: "cancelled" }
  | { readonly category: "renderer-unavailable" }
  | { readonly category: "destination-conflict" }
  | { readonly category: "provider-not-registered"; readonly providerId: string }
  | { readonly category: "rendering-failed" };

export interface ImportSuccess {
  readonly path: string;
  readonly annotationCount: number;
  readonly warnings: readonly PostCommitWarning[];
}

export type ImportResult = Result<ImportSuccess, ImportError>;
export type SnapshotResult = Result<ImportSnapshot, ImportError>;
export type PreparationResult = Result<ImportSnapshot | undefined, ImportError>;

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const failure = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type ProviderBooksResult = ProviderResult<readonly ProviderBook[]>;
export type ProviderAnnotationsResult = ProviderResult<readonly BookAnnotation[]>;
