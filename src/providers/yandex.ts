import { ApiError, UnauthorizedError } from "yandex-book-api-ts";

import {
  createBookAnnotation,
  createProviderBook,
  type BookAnnotation,
  type ProviderBook,
} from "../core/models";
import {
  failure,
  ok,
  type ProviderError,
  type ProviderResult,
  type ReadingProviderPort,
} from "../core/ports";
import { parseYandexQuoteCreatedAt, parseYandexQuoteCsv } from "./yandex-quotes-csv";

export interface YandexClient {
  readonly getProfile: () => Promise<{ readonly login?: string } | undefined>;
  readonly getMyLibrary: (limit?: number, offset?: number) => Promise<readonly unknown[]>;
  readonly exportBookQuotes: (bookId: string, format: "csv") => Promise<string>;
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

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

const libraryStatus = (state: unknown): "in-progress" | "finished" | "unknown" => {
  const normalized = typeof state === "string" ? state.trim().toLowerCase() : "";
  if (normalized === "reading") return "in-progress";
  if (normalized === "finished") return "finished";
  return "unknown";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizedText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const libraryTitle = (book: Record<string, unknown>): string =>
  normalizedText(book.title) || normalizedText(book.name);

const libraryAuthors = (book: Record<string, unknown>): readonly string[] => {
  if (!Array.isArray(book.authors)) return [];

  return book.authors.flatMap((author) => {
    const name = isRecord(author) ? normalizedText(author.name) : "";
    return name ? [name] : [];
  });
};

const sanitizeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const sanitized = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/<[^>]*>/g, "").trim();
  return sanitized || undefined;
};

export const createYandexBooksProvider = (
  createClient: (credential: string) => YandexClient,
): ReadingProviderPort => ({
  id: "yandex-books",
  displayName: "Yandex Books",
  annotationFetch: "early",
  testCredential: async (credential): Promise<ProviderResult<void>> => {
    try {
      const profile = await createClient(credential).getProfile();
      return profile?.login?.trim() ? ok(undefined) : providerError("incomplete-data");
    } catch (error) {
      return credentialError(error);
    }
  },
  listBooks: async (credential): Promise<ProviderResult<readonly ProviderBook[]>> => {
    try {
      const client = createClient(credential);
      const books: ProviderBook[] = [];
      const pageSignatures = new Set<string>();
      const bookIds = new Set<string>();

      for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
        const page: unknown = await client.getMyLibrary(PAGE_SIZE, pageIndex * PAGE_SIZE);
        if (!Array.isArray(page)) return providerError("incomplete-data");

        if (page.length === PAGE_SIZE) {
          const signature = JSON.stringify(page.map((card) => {
            if (!isRecord(card)) return ["", "", ""];
            const book = isRecord(card.book) ? card.book : undefined;
            const progress = card.readingProgress;
            return [
              normalizedText(book?.uuid),
              normalizedText(card.state).toLowerCase(),
              typeof progress === "number" && Number.isFinite(progress) ? String(progress) : "",
            ];
          }));
          if (pageSignatures.has(signature)) return providerError("incomplete-data");
          pageSignatures.add(signature);
        }

        let addedBook = false;
        for (const card of page) {
          if (!isRecord(card) || !isRecord(card.book)) continue;

          const bookId = normalizedText(card.book.uuid);
          if (!bookId || bookIds.has(bookId)) continue;

          bookIds.add(bookId);
          addedBook = true;
          books.push(createProviderBook({
            providerId: "yandex-books",
            bookId,
            title: libraryTitle(card.book),
            authors: libraryAuthors(card.book),
            status: libraryStatus(card.state),
          }));
        }

        if (page.length === PAGE_SIZE && !addedBook) return providerError("incomplete-data");
        if (page.length < PAGE_SIZE) return ok(Object.freeze(books));
      }

      return providerError("incomplete-data");
    } catch (error) {
      return credentialError(error);
    }
  },
  fetchAnnotations: async (credential, book): Promise<ProviderResult<readonly BookAnnotation[]>> => {
    let exportText: string;
    try {
      exportText = await createClient(credential).exportBookQuotes(book.bookId, "csv");
    } catch (error) {
      return credentialError(error);
    }

    let rows: ReturnType<typeof parseYandexQuoteCsv>;
    try {
      rows = parseYandexQuoteCsv(exportText);
    } catch {
      return providerError("incomplete-data");
    }

    const annotations = rows.flatMap((row, inputIndex) => {
      const text = sanitizeText(row.content);
      const comment = sanitizeText(row.comment);
      if (text === undefined && comment === undefined) return [];

      const createdAt = parseYandexQuoteCreatedAt(row.created_at);
      return [createBookAnnotation({
        ...(text === undefined ? {} : { text }),
        ...(comment === undefined ? {} : { comment }),
        ...(createdAt === undefined ? {} : { createdAt }),
        inputIndex,
      })];
    });
    return ok(Object.freeze(annotations));
  },
});
