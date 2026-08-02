import { ApiError, UnauthorizedError } from "yandex-book-api-ts";
import { describe, expect, it, vi } from "vitest";
import { createProviderBook } from "../../src/core/models";
import { createYandexBooksProvider, type YandexClient } from "../../src/providers/yandex";

const client = (overrides: Partial<YandexClient> = {}): YandexClient => ({
  getProfile: () => Promise.resolve(undefined),
  getMyLibrary: () => Promise.resolve([]),
  getUserQuotes: () => Promise.resolve([]),
  ...overrides,
});

interface LibraryCardFixture {
  readonly state: string;
  readonly readingProgress: number;
  readonly book: {
    readonly uuid: string;
    readonly title?: string;
    readonly name?: string;
    readonly authors?: readonly { readonly name?: string }[];
  };
}

const card = (uuid: string, state = "pending"): LibraryCardFixture => ({
  state,
  readingProgress: 0.5,
  book: { uuid },
});

const fullPageOf = (count: number, state = "pending"): readonly LibraryCardFixture[] =>
  Array.from({ length: count }, (_value, index) => card(`book-${String(index + 1)}`, state));

const fullPageWithoutTextBookIds = (count: number): readonly { readonly book: { readonly uuid: string } }[] =>
  Array.from({ length: count }, () => ({ book: { uuid: "  " } }));

interface QuoteFixture {
  readonly itemUuid: string;
  readonly cfi: string;
  readonly startNodeXpath: string;
  readonly startNodeOffset: number;
  readonly finishNodeXpath: string;
  readonly finishNodeOffset: number;
  readonly content: string;
  readonly comment: string;
  readonly progress: number;
  readonly createdAt?: number;
  readonly book: { readonly uuid?: string };
}

const quote = (overrides: Partial<{
  readonly bookId: string | undefined;
  readonly itemUuid: string;
  readonly cfi: string;
  readonly startNodeXpath: string;
  readonly startNodeOffset: number;
  readonly finishNodeXpath: string;
  readonly finishNodeOffset: number;
  readonly content: string;
  readonly comment: string;
  readonly progress: number;
  readonly createdAt: number | undefined;
}> = {}): QuoteFixture => {
  const {
    itemUuid = "unstable-item-uuid",
    cfi = "epubcfi(/6/2)",
    startNodeXpath = "/html/body/p[1]",
    startNodeOffset = 0,
    finishNodeXpath = "/html/body/p[1]",
    finishNodeOffset = 9,
    content = "quote",
    comment = "comment",
    progress = 0.5,
    createdAt,
  } = overrides;
  const bookId = "bookId" in overrides ? overrides.bookId : "book-1";

  return {
    itemUuid,
    cfi,
    startNodeXpath,
    startNodeOffset,
    finishNodeXpath,
    finishNodeOffset,
    content,
    comment,
    progress,
    ...(createdAt === undefined ? {} : { createdAt }),
    book: bookId === undefined ? {} : { uuid: bookId },
  };
};

const fullQuotePageOf = (count: number, bookId: string, prefix = "quote"): readonly QuoteFixture[] =>
  Array.from({ length: count }, (_value, index) => quote({
    bookId,
    itemUuid: `unstable-item-${prefix}-${String(index + 1)}`,
    content: `${prefix}-${String(index + 1)}`,
  }));

const selectedBook = createProviderBook({
  providerId: "yandex-books",
  bookId: "book-1",
  title: "Selected book",
  authors: [],
});

const providerFor = (overrides: Partial<YandexClient> = {}): ReturnType<typeof createYandexBooksProvider> => createYandexBooksProvider(() => client({
  getProfile: () => Promise.resolve({ login: "reader" }),
  ...overrides,
}));

describe("Yandex Books provider credential validation", () => {
  it("accepts a profile with a non-blank login", async () => {
    const provider = createYandexBooksProvider(() => client({
      getProfile: () => Promise.resolve({ login: "reader" }),
    }));

    await expect(provider.testCredential("secret-token")).resolves.toEqual({ ok: true, value: undefined });
  });

  it.each([
    [new UnauthorizedError("unsafe token message"), "authentication"],
    [new TypeError("offline"), "provider-unavailable"],
    [new ApiError("rejected", { status: 400 }), "incomplete-data"],
    [undefined, "incomplete-data"],
    [{ login: "  " }, "incomplete-data"],
    [new Error("unknown provider detail"), "provider-unavailable"],
  ] as const)("maps credential failure safely", async (outcome, category) => {
    const provider = createYandexBooksProvider(() => client({
      getProfile: () => outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome),
    }));

    const result = await provider.testCredential("secret-token");

    expect(result).toEqual({ ok: false, error: { category, providerId: "yandex-books" } });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
});

describe("Yandex Books provider library", () => {
  it("advances offsets and stops after a short final page", async () => {
    const getMyLibrary = vi.fn<YandexClient["getMyLibrary"]>()
      .mockResolvedValueOnce(fullPageOf(100, "reading"))
      .mockResolvedValueOnce([card("book-101", "finished")]);
    const result = await createYandexBooksProvider(() => client({ getMyLibrary })).listBooks("secret");

    expect(getMyLibrary).toHaveBeenNthCalledWith(1, 100, 0);
    expect(getMyLibrary).toHaveBeenNthCalledWith(2, 100, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ bookId: "book-1", status: "in-progress" }),
      expect.objectContaining({ bookId: "book-101", status: "finished" }),
    ]));
  });

  it("maps book titles and author names from library cards", async () => {
    const result = await createYandexBooksProvider(() => client({
      getMyLibrary: () => Promise.resolve([
        {
          ...card("book-1", "reading"),
          book: {
            uuid: "book-1",
            title: "  The Title Field  ",
            authors: [{ name: "  First Author  " }, { name: "Second Author" }, { name: "  " }],
          },
        },
        {
          ...card("book-2", "finished"),
          book: {
            uuid: "book-2",
            name: "  The Name Fallback  ",
            authors: [{ name: "Fallback Author" }],
          },
        },
      ]),
    })).listBooks("secret");

    expect(result).toEqual({ ok: true, value: [
      expect.objectContaining({
        bookId: "book-1",
        title: "The Title Field",
        authors: ["First Author", "Second Author"],
      }),
      expect.objectContaining({
        bookId: "book-2",
        title: "The Name Fallback",
        authors: ["Fallback Author"],
      }),
    ] });
  });

  it.each<readonly [string, readonly (readonly unknown[])[]]>([
    ["repeats a full page", [fullPageOf(100), fullPageOf(100)]],
    ["receives no usable books in a full page", [fullPageWithoutTextBookIds(100)]],
  ])("rejects incomplete library data when it %s", async (_name, pages) => {
    const result = await createYandexBooksProvider(() => client({
      getMyLibrary: (_limit, offset) => Promise.resolve(pages[(offset ?? 0) / 100] ?? []),
    })).listBooks("secret");

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
  });

  it("rejects after 100 distinct full pages", async () => {
    const getMyLibrary = vi.fn<YandexClient["getMyLibrary"]>((_limit, offset) => {
      const firstBookId = (offset ?? 0) + 1;
      return Promise.resolve(Array.from(
        { length: 100 },
        (_value, index) => card(`book-${String(firstBookId + index)}`),
      ));
    });
    const result = await createYandexBooksProvider(() => client({ getMyLibrary })).listBooks("secret");

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
    expect(getMyLibrary).toHaveBeenCalledTimes(100);
    expect(getMyLibrary).toHaveBeenLastCalledWith(100, 9_900);
  });

  it("rejects a malformed non-array library response", async () => {
    const result = await createYandexBooksProvider(() => client({
      getMyLibrary: () => Promise.resolve({} as unknown as readonly unknown[]),
    })).listBooks("secret");

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
  });

  it("excludes cards without a non-blank book UUID", async () => {
    const result = await createYandexBooksProvider(() => client({
      getMyLibrary: () => Promise.resolve([{ book: {} }, card("book-1")]),
    })).listBooks("secret");

    expect(result).toEqual({ ok: true, value: [expect.objectContaining({ bookId: "book-1" })] });
  });

  it("keeps unproven states unknown and omits reading progress", async () => {
    const result = await createYandexBooksProvider(() => client({
      getMyLibrary: () => Promise.resolve([card("book-1", "pending")]),
    })).listBooks("secret");

    expect(result).toEqual({ ok: true, value: [expect.objectContaining({
      bookId: "book-1",
      status: "unknown",
    })] });
    if (result.ok) expect(result.value[0]).not.toHaveProperty("progress");
  });
});

describe("Yandex Books provider quote pagination", () => {
  it("uses the authenticated profile login and stops after a short quote page", async () => {
    const getUserQuotes = vi.fn<YandexClient["getUserQuotes"]>()
      .mockResolvedValueOnce(fullQuotePageOf(100, "book-1"))
      .mockResolvedValueOnce([quote({ bookId: "book-1", content: "last" })]);

    const result = await providerFor({ getUserQuotes }).fetchAnnotations("secret", selectedBook);

    expect(getUserQuotes).toHaveBeenNthCalledWith(1, "reader", 1, 100);
    expect(getUserQuotes).toHaveBeenNthCalledWith(2, "reader", 2, 100);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.value)).toBe(true);
  });

  it("preserves identical records on one page", async () => {
    const duplicate = quote({ bookId: "book-1", content: "same" });

    const result = await providerFor({ getUserQuotes: () => Promise.resolve([duplicate, duplicate]) })
      .fetchAnnotations("secret", selectedBook);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map(({ inputIndex }) => inputIndex)).toEqual([0, 1]);
  });

  it.each<readonly [string, readonly (readonly unknown[])[]]>([
    ["a repeated full page", [fullQuotePageOf(100, "book-1"), fullQuotePageOf(100, "book-1")]],
    ["a cross-page fingerprint overlap despite different item UUIDs", [
      fullQuotePageOf(100, "book-1"),
      [quote({ bookId: "book-1", content: "quote-1", itemUuid: "another-unstable-item" })],
    ]],
    ["a malformed page", [{} as unknown as readonly unknown[]]],
    ["a full page with no new normalized fingerprint", [
      fullQuotePageOf(100, "book-1"),
      [...fullQuotePageOf(100, "book-1")].reverse(),
    ]],
  ] as const)("fails rather than returning a partial snapshot on %s", async (_name, pages) => {
    const result = await providerFor({
      getUserQuotes: (_login, page) => Promise.resolve(pages[(page ?? 1) - 1] ?? []),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
  });

  it("fails after the 100-page quote limit", async () => {
    const getUserQuotes = vi.fn<YandexClient["getUserQuotes"]>((_login, page) =>
      Promise.resolve(fullQuotePageOf(100, "book-1", `page-${String(page)}`)),
    );

    const result = await providerFor({ getUserQuotes }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
    expect(getUserQuotes).toHaveBeenCalledTimes(100);
    expect(getUserQuotes).toHaveBeenLastCalledWith("reader", 100, 100);
  });

  it.each([undefined, { login: "  " }] as const)("rejects a missing or blank profile login without fetching quotes", async (profile) => {
    const getUserQuotes = vi.fn<YandexClient["getUserQuotes"]>();

    const result = await providerFor({
      getProfile: () => Promise.resolve(profile),
      getUserQuotes,
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
    expect(getUserQuotes).not.toHaveBeenCalled();
  });
});

describe("Yandex Books provider quote mapping", () => {
  it("maps selected-book highlights and comments with sanitized text", async () => {
    const result = await providerFor({
      getUserQuotes: () => Promise.resolve([
        quote({ bookId: "book-1", content: "<b> Highlight </b>\r\ntext", comment: " Note " }),
        quote({ bookId: "other-book", content: "ignore" }),
      ]),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: true, value: [{
      text: "Highlight \ntext",
      comment: "Note",
      progress: expect.any(Number) as unknown,
      inputIndex: 0,
    }] });
  });

  it("normalizes bare carriage returns in quote text", async () => {
    const result = await providerFor({
      getUserQuotes: () => Promise.resolve([quote({ bookId: "book-1", content: "first\rsecond" })]),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: true, value: [expect.objectContaining({ text: "first\nsecond" })] });
  });

  it("rejects an importable quote without an owning book identity", async () => {
    const result = await providerFor({
      getUserQuotes: () => Promise.resolve([quote({ bookId: undefined, content: "unowned" })]),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
  });

  it("rejects an importable quote with a whitespace-only owning book UUID", async () => {
    const result = await providerFor({
      getUserQuotes: () => Promise.resolve([quote({ bookId: "  ", content: "unowned" })]),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
  });

  it("excludes a quote only when both highlight and comment are blank", async () => {
    const result = await providerFor({
      getUserQuotes: () => Promise.resolve([
        quote({ bookId: undefined, content: " ", comment: " " }),
        quote({ bookId: "book-1", content: " ", comment: "comment-only" }),
      ]),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: true, value: [expect.objectContaining({ comment: "comment-only" })] });
  });

  it("maps only verified fields and includes creation times only when finite", async () => {
    const result = await providerFor({
      getUserQuotes: () => Promise.resolve([{
        ...quote({ bookId: "book-1", progress: 0.5, createdAt: 1_700_000_000 }),
        readingProgress: 0.75,
      }, quote({ bookId: "book-1", createdAt: Number.NaN })]),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: true, value: [
      expect.objectContaining({
        text: "quote",
        comment: "comment",
        progress: 0.5,
        createdAt: 1_700_000_000,
        inputIndex: 0,
      }),
      expect.objectContaining({ inputIndex: 1 }),
    ] });
    if (!result.ok) return;
    expect(result.value[0]).not.toHaveProperty("sourceKey");
    expect(result.value[0]).not.toHaveProperty("location");
    expect(result.value[0]).not.toHaveProperty("sectionPath");
    expect(result.value[0]).not.toHaveProperty("readingProgress");
    expect(result.value[1]).not.toHaveProperty("createdAt");
  });

  it("omits non-finite quote progress", async () => {
    const result = await providerFor({
      getUserQuotes: () => Promise.resolve([
        quote({ bookId: "book-1", progress: Number.NaN }),
        quote({ bookId: "book-1", progress: Number.POSITIVE_INFINITY }),
      ]),
    }).fetchAnnotations("secret", selectedBook);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).not.toHaveProperty("progress");
    expect(result.value[1]).not.toHaveProperty("progress");
  });

  it("does not expose credentials or thrown provider text", async () => {
    const result = await providerFor({
      getUserQuotes: () => Promise.reject(new Error("<unsafe provider detail>")),
    }).fetchAnnotations("secret-token", selectedBook);

    expect(result).toEqual({ ok: false, error: { category: "provider-unavailable", providerId: "yandex-books" } });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("unsafe provider detail");
  });
});
