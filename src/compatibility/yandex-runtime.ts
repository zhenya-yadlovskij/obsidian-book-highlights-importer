import {
  ApiError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "yandex-book-api-ts";

import { parseYandexQuoteCsv } from "../providers/yandex-quotes-csv";

export const YANDEX_TOKEN_SECRET_ID = "book-highlights-importer-yandex-books-token";

export interface RuntimeSecretStorage {
  readonly getSecret: (id: string) => string | null;
  readonly setSecret: (id: string, secret: string) => void;
}

interface RuntimeProfile {
  readonly login?: string;
}

interface RuntimeBook {
  readonly uuid?: string;
}

interface RuntimeLibraryCard {
  readonly state?: string;
  readonly readingProgress?: number;
  readonly book?: RuntimeBook;
}

export interface YandexRuntimeClient {
  readonly getProfile: () => Promise<RuntimeProfile | undefined>;
  readonly getMyLibrary: (limit?: number, offset?: number) => Promise<readonly RuntimeLibraryCard[]>;
  readonly exportBookQuotes: (bookId: string, format: "csv") => Promise<string>;
}

export interface RuntimeStateEvidence {
  readonly state: string;
  readonly count: number;
  readonly progressMin?: number;
  readonly progressMax?: number;
}

export type YandexRuntimeResult =
  | {
    readonly ok: true;
    readonly library: {
      readonly count: number;
      readonly states: readonly RuntimeStateEvidence[];
    };
    readonly quotes: {
      readonly count: number;
      readonly importableCount: number;
      readonly structuralStatus: "valid";
    };
  }
  | {
    readonly ok: false;
    readonly stage: "credential" | "client" | "profile" | "library" | "quotes";
    readonly errorType: string;
    readonly status?: number;
    readonly reason?: "fetch-failed" | "forbidden-header" | "transport";
  };

export interface YandexRuntimeHarness {
  readonly isConfigured: () => boolean;
  readonly saveCredential: (credential: string) => void;
  readonly clearCredential: () => void;
  readonly run: () => Promise<YandexRuntimeResult>;
}

const failure = (
  stage: "client" | "profile" | "library" | "quotes",
  error: unknown,
): YandexRuntimeResult => {
  const errorType = error instanceof UnauthorizedError
    ? "UnauthorizedError"
    : error instanceof NotFoundError
      ? "NotFoundError"
      : error instanceof BadRequestError
        ? "BadRequestError"
        : error instanceof ApiError
          ? "ApiError"
          : error instanceof TypeError
            ? "TypeError"
            : error instanceof Error
              ? "Error"
              : "UnknownError";
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : undefined;
  let reason: "fetch-failed" | "forbidden-header" | "transport" | undefined;
  if (error instanceof ApiError && status === undefined) {
    const details = error.details;
    const serializedDetails = typeof details === "string"
      ? details
      : details === undefined
        ? ""
        : JSON.stringify(details);
    const normalizedDetails = serializedDetails.toLowerCase();
    if (
      normalizedDetails.includes("unsafe header") ||
      normalizedDetails.includes("forbidden header") ||
      normalizedDetails.includes("refused to set") && normalizedDetails.includes("header")
    ) {
      reason = "forbidden-header";
    } else if (
      normalizedDetails.includes("failed to fetch") ||
      normalizedDetails.includes("fetch failed") ||
      normalizedDetails.includes("networkerror") ||
      normalizedDetails.includes("network request failed") ||
      normalizedDetails.includes("load failed")
    ) {
      reason = "fetch-failed";
    } else {
      reason = "transport";
    }
  }
  return {
    ok: false,
    stage,
    errorType,
    ...(status === undefined ? {} : { status }),
    ...(reason === undefined ? {} : { reason }),
  };
};

const summarizeStates = (cards: readonly RuntimeLibraryCard[]): readonly RuntimeStateEvidence[] => {
  const groups = new Map<string, { count: number; progress: number[] }>();
  for (const card of cards) {
    const rawState = card.state?.trim() ?? "";
    const state = rawState === "" ? "unknown" : rawState;
    const group = groups.get(state) ?? { count: 0, progress: [] };
    group.count += 1;
    if (typeof card.readingProgress === "number" && Number.isFinite(card.readingProgress)) {
      group.progress.push(card.readingProgress);
    }
    groups.set(state, group);
  }
  return Object.freeze(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([state, group]) => Object.freeze({
        state,
        count: group.count,
        ...(group.progress.length === 0
          ? {}
          : {
            progressMin: Math.min(...group.progress),
            progressMax: Math.max(...group.progress),
          }),
      })),
  );
};

export const createYandexRuntimeHarness = (
  secrets: RuntimeSecretStorage,
  createClient: (credential: string) => YandexRuntimeClient,
): YandexRuntimeHarness => {
  const currentCredential = (): string | null => {
    const credential = secrets.getSecret(YANDEX_TOKEN_SECRET_ID)?.trim();
    if (credential === undefined || credential === "") return null;
    return credential;
  };

  const run = async (): Promise<YandexRuntimeResult> => {
    const credential = currentCredential();
    if (credential === null) {
      return { ok: false, stage: "credential", errorType: "MissingCredential" };
    }
    let client: YandexRuntimeClient;
    try {
      client = createClient(credential);
    } catch (error) {
      return failure("client", error);
    }

    let profile: RuntimeProfile | undefined;
    try {
      profile = await client.getProfile();
    } catch (error) {
      return failure("profile", error);
    }
    const login = profile?.login?.trim();
    if (!login) {
      return { ok: false, stage: "profile", errorType: "MissingLogin" };
    }

    let library: readonly RuntimeLibraryCard[];
    try {
      library = await client.getMyLibrary(100, 0);
    } catch (error) {
      return failure("library", error);
    }

    const selectedBookId = library
      .map((card) => card.book?.uuid?.trim())
      .find((bookId): bookId is string => bookId !== undefined && bookId !== "");
    if (selectedBookId === undefined) {
      return { ok: false, stage: "library", errorType: "MissingBookId" };
    }

    let exportText: string;
    try {
      exportText = await client.exportBookQuotes(selectedBookId, "csv");
    } catch (error) {
      return failure("quotes", error);
    }

    let rows: ReturnType<typeof parseYandexQuoteCsv>;
    try {
      rows = parseYandexQuoteCsv(exportText);
    } catch {
      return { ok: false, stage: "quotes", errorType: "InvalidQuoteExport" };
    }
    const hasText = (value: string): boolean => value.trim().length > 0;
    const importableCount = rows.filter((row) => hasText(row.content) || hasText(row.comment)).length;

    return Object.freeze({
      ok: true,
      library: Object.freeze({ count: library.length, states: summarizeStates(library) }),
      quotes: Object.freeze({
        count: rows.length,
        importableCount,
        structuralStatus: "valid",
      }),
    });
  };

  return Object.freeze({
    isConfigured: () => currentCredential() !== null,
    saveCredential: (credential: string): void => {
      secrets.setSecret(YANDEX_TOKEN_SECRET_ID, credential.trim());
    },
    clearCredential: (): void => {
      secrets.setSecret(YANDEX_TOKEN_SECRET_ID, "");
    },
    run,
  });
};
