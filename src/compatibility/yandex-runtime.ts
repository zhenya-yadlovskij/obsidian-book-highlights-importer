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

interface RuntimeQuote {
  readonly itemUuid?: string;
  readonly content?: string;
  readonly comment?: string;
  readonly book?: RuntimeBook;
  readonly authorsObjects: readonly unknown[];
}

export interface YandexRuntimeClient {
  readonly getProfile: () => Promise<RuntimeProfile | undefined>;
  readonly getMyLibrary: (limit?: number, offset?: number) => Promise<readonly RuntimeLibraryCard[]>;
  readonly getUserQuotes: (userId: string, page?: number, perPage?: number) => Promise<readonly RuntimeQuote[]>;
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
      readonly missingBookIdentityCount: number;
      readonly itemUuidPresentCount: number;
      readonly itemUuidUniqueCount: number;
    };
  }
  | {
    readonly ok: false;
    readonly stage: "credential" | "client" | "profile" | "library" | "quotes";
    readonly errorType: string;
    readonly status?: number;
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
  const errorType = error instanceof Error ? error.constructor.name : "UnknownError";
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : undefined;
  return {
    ok: false,
    stage,
    errorType,
    ...(status === undefined ? {} : { status }),
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

    let quotes: readonly RuntimeQuote[];
    try {
      quotes = await client.getUserQuotes(login, 1, 100);
    } catch (error) {
      return failure("quotes", error);
    }
    const hasText = (value: string | undefined): boolean => (value?.trim().length ?? 0) > 0;
    const importable = quotes.filter((quote) => hasText(quote.content) || hasText(quote.comment));
    const itemUuids = quotes
      .map((quote) => quote.itemUuid?.trim())
      .filter((itemUuid): itemUuid is string => itemUuid !== undefined && itemUuid !== "");

    return Object.freeze({
      ok: true,
      library: Object.freeze({ count: library.length, states: summarizeStates(library) }),
      quotes: Object.freeze({
        count: quotes.length,
        importableCount: importable.length,
        missingBookIdentityCount: importable.filter((quote) => !quote.book?.uuid?.trim()).length,
        itemUuidPresentCount: itemUuids.length,
        itemUuidUniqueCount: new Set(itemUuids).size,
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
