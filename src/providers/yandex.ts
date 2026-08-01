import { ApiError, UnauthorizedError } from "yandex-book-api-ts";
import {
  failure,
  ok,
  type ProviderError,
  type ProviderResult,
  type ReadingProviderPort,
} from "../core/ports";

export interface YandexClient {
  readonly getProfile: () => Promise<{ readonly login?: string } | undefined>;
  readonly getMyLibrary: (limit?: number, offset?: number) => Promise<readonly unknown[]>;
  readonly getUserQuotes: (login: string, page?: number, perPage?: number) => Promise<readonly unknown[]>;
}

const providerError = (category: ProviderError["category"]): ProviderResult<never> =>
  failure({ category, providerId: "yandex-books" });

const credentialError = (error: unknown): ProviderResult<never> => {
  if (error instanceof UnauthorizedError) return providerError("authentication");
  if (error instanceof ApiError && error.status === 401) return providerError("authentication");
  if (error instanceof ApiError && error.status !== undefined && error.status >= 400 && error.status < 500) {
    return providerError("incomplete-data");
  }
  return providerError("provider-unavailable");
};

export const createYandexBooksProvider = (
  createClient: (credential: string) => YandexClient,
): ReadingProviderPort => ({
  id: "yandex-books",
  displayName: "Yandex Books",
  annotationFetch: "early",
  testCredential: async (credential) => {
    try {
      const profile = await createClient(credential).getProfile();
      return profile?.login?.trim() ? ok(undefined) : providerError("incomplete-data");
    } catch (error) {
      return credentialError(error);
    }
  },
  listBooks: async () => providerError("provider-unavailable"),
  fetchAnnotations: async () => providerError("provider-unavailable"),
});
