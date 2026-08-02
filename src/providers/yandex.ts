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

const isUnknownArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const normalizedText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const sanitizeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const sanitized = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/<[^>]*>/g, "").trim();
  return sanitized || undefined;
};

const libraryPageSignature = (page: readonly unknown[]): string => JSON.stringify(page.map((card) => {
  if (!isRecord(card)) return ["", "", ""];

  const book = isRecord(card.book) ? card.book : undefined;
  const progress = card.readingProgress;
  return [
    normalizedText(book?.uuid),
    normalizedText(card.state).toLowerCase(),
    typeof progress === "number" && Number.isFinite(progress) ? String(progress) : "",
  ];
}));

const normalizedNumber = (value: unknown): string =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : "";

const quoteFingerprint = (quote: unknown): string => {
  const record = isRecord(quote) ? quote : undefined;
  const book = isRecord(record?.book) ? record.book : undefined;

  return JSON.stringify([
    normalizedText(book?.uuid),
    normalizedText(record?.content),
    normalizedText(record?.comment),
    normalizedText(record?.cfi),
    normalizedText(record?.startNodeXpath),
    normalizedNumber(record?.startNodeOffset),
    normalizedText(record?.finishNodeXpath),
    normalizedNumber(record?.finishNodeOffset),
    normalizedNumber(record?.progress),
    normalizedNumber(record?.createdAt),
  ]);
};

const mapCollectedQuotes = (
  quotes: readonly unknown[],
  selectedBook: ProviderBook,
): readonly BookAnnotation[] | undefined => {
  const annotations: BookAnnotation[] = [];

  for (const [inputIndex, quote] of quotes.entries()) {
    const record = isRecord(quote) ? quote : undefined;
    const text = sanitizeText(record?.content);
    const comment = sanitizeText(record?.comment);
    if (text === undefined && comment === undefined) continue;

    const quoteBook = isRecord(record?.book) ? record.book : undefined;
    const bookId = normalizedText(quoteBook?.uuid);
    if (!bookId) return undefined;
    if (bookId !== selectedBook.bookId) continue;

    annotations.push(createBookAnnotation({
      ...(text === undefined ? {} : { text }),
      ...(comment === undefined ? {} : { comment }),
      ...(typeof record?.progress === "number" && Number.isFinite(record.progress)
        ? { progress: record.progress }
        : {}),
      ...(typeof record?.createdAt === "number" && Number.isFinite(record.createdAt)
        ? { createdAt: record.createdAt }
        : {}),
      inputIndex,
    }));
  }

  return Object.freeze(annotations);
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
          const signature = libraryPageSignature(page);
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
            title: "",
            authors: [],
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
    try {
      const client = createClient(credential);
      const profile = await client.getProfile();
      const login = normalizedText(profile?.login);
      if (!login) return providerError("incomplete-data");

      const quotes: unknown[] = [];
      const pageSignatures = new Set<string>();
      const acceptedFingerprints = new Set<string>();

      for (let pageIndex = 1; pageIndex <= MAX_PAGES; pageIndex += 1) {
        const page: unknown = await client.getUserQuotes(login, pageIndex, PAGE_SIZE);
        if (!isUnknownArray(page)) return providerError("incomplete-data");

        const fingerprints = page.map(quoteFingerprint);
        const isFullPage = page.length === PAGE_SIZE;
        const signature = isFullPage ? JSON.stringify(fingerprints) : undefined;
        if (signature !== undefined && pageSignatures.has(signature)) return providerError("incomplete-data");
        if (fingerprints.some((fingerprint) => acceptedFingerprints.has(fingerprint))) {
          return providerError("incomplete-data");
        }

        const newFingerprints = new Set(fingerprints);
        if (isFullPage && newFingerprints.size === 0) return providerError("incomplete-data");

        if (signature !== undefined) pageSignatures.add(signature);
        for (const fingerprint of newFingerprints) acceptedFingerprints.add(fingerprint);
        quotes.push(...page);

        if (!isFullPage) {
          const annotations = mapCollectedQuotes(quotes, book);
          return annotations === undefined ? providerError("incomplete-data") : ok(annotations);
        }
      }

      return providerError("incomplete-data");
    } catch (error) {
      return credentialError(error);
    }
  },
});
