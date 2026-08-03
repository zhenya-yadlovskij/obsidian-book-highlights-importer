import { ApiError, UnauthorizedError } from "yandex-book-api-ts";
import { describe, expect, it, vi } from "vitest";

import { orderAnnotations } from "../../src/core/annotations";
import { createProviderBook } from "../../src/core/models";
import { createYandexBooksProvider, type YandexClient } from "../../src/providers/yandex";

const client = (overrides: Partial<YandexClient> = {}): YandexClient => ({
  getProfile: () => Promise.resolve(undefined),
  getMyLibrary: () => Promise.resolve([]),
  exportBookQuotes: () => Promise.resolve("book_title,book_authors,content,comment,color,created_at\n"),
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

const selectedBook = createProviderBook({
  providerId: "yandex-books",
  bookId: "book-1",
  title: "Library title",
  authors: ["Library author"],
});

const providerFor = (
  overrides: Partial<YandexClient> = {},
): ReturnType<typeof createYandexBooksProvider> => createYandexBooksProvider(() => client({
  getProfile: () => Promise.resolve({ login: "reader" }),
  ...overrides,
}));

const csv = (rows: readonly Partial<Record<
  "book_title" | "book_authors" | "content" | "comment" | "color" | "created_at",
  string
>>[]): string => {
  const headers = ["book_title", "book_authors", "content", "comment", "color", "created_at"] as const;
  const escape = (value: string): string => `"${value.replaceAll('"', '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
    "",
  ].join("\n");
};

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
      expect.objectContaining({ bookId: "book-1", title: "The Title Field", authors: ["First Author", "Second Author"] }),
      expect.objectContaining({ bookId: "book-2", title: "The Name Fallback", authors: ["Fallback Author"] }),
    ] });
  });

  it.each<readonly [string, readonly (readonly unknown[])[]]>([
    ["repeats a full page", [fullPageOf(100), fullPageOf(100)]],
    ["receives no usable books in a full page", [fullPageWithoutTextBookIds(100)]],
  ] as const)("rejects incomplete library data when it %s", async (_name, pages) => {
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

    expect(result).toEqual({ ok: true, value: [expect.objectContaining({ bookId: "book-1", status: "unknown" })] });
    if (result.ok) expect(result.value[0]).not.toHaveProperty("progress");
  });
});

describe("Yandex Books selected-book quote export", () => {
  it("calls the selected-book CSV export once without requiring profile login", async () => {
    const getProfile = vi.fn<YandexClient["getProfile"]>(() => Promise.reject(new Error("profile should not be used")));
    const exportBookQuotes = vi.fn<YandexClient["exportBookQuotes"]>(() => Promise.resolve(csv([])));
    const result = await providerFor({ getProfile, exportBookQuotes }).fetchAnnotations("secret", selectedBook);

    expect(exportBookQuotes).toHaveBeenCalledOnce();
    expect(exportBookQuotes).toHaveBeenCalledWith("book-1", "csv");
    expect(getProfile).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: [] });
  });

  it("maps sanitized content and comments while preserving export row indexes", async () => {
    const result = await providerFor({
      exportBookQuotes: () => Promise.resolve(csv([
        { book_title: "Export title", book_authors: "Export author", content: " ", comment: " " },
        { content: "<b> Highlight </b>\r\ntext", comment: " Note ", color: "yellow" },
        { content: "", comment: "comment-only", color: "blue" },
        { content: "Unicode café 東京\nmultiline", comment: "" },
      ])),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: true, value: [
      { text: "Highlight \ntext", comment: "Note", inputIndex: 1 },
      { comment: "comment-only", inputIndex: 2 },
      { text: "Unicode café 東京\nmultiline", inputIndex: 3 },
    ] });
  });

  it("does not copy export metadata, color, progress, or source identifiers", async () => {
    const result = await providerFor({
      exportBookQuotes: () => Promise.resolve(csv([{
        book_title: "Wrong title",
        book_authors: "Wrong author",
        content: "text",
        comment: "comment",
        color: "yellow",
        created_at: "2025-01-01 10:00:00 +0300",
      }])),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: true, value: [{
      text: "text",
      comment: "comment",
      createdAt: 1_735_714_800,
      inputIndex: 0,
    }] });
    if (result.ok) {
      expect(result.value[0]).not.toHaveProperty("progress");
      expect(result.value[0]).not.toHaveProperty("sourceKey");
    }
  });

  it("preserves identical importable rows as separate immutable annotations", async () => {
    const result = await providerFor({
      exportBookQuotes: () => Promise.resolve(csv([
        { content: "same", comment: "same" },
        { content: "same", comment: "same" },
      ])),
    }).fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: true, value: [
      { text: "same", comment: "same", inputIndex: 0 },
      { text: "same", comment: "same", inputIndex: 1 },
    ] });
    if (result.ok) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value[0])).toBe(true);
    }
  });

  it("orders absolute times oldest first and leaves equal or undated rows stable", async () => {
    const result = await providerFor({
      exportBookQuotes: () => Promise.resolve(csv([
        { content: "equal first", created_at: "2025-01-01 08:30:00 +0000" },
        { content: "undated", created_at: "invalid" },
        { content: "older absolute", created_at: "2025-01-01 10:00:00 +0300" },
        { content: "equal second", created_at: "2025-01-01 08:30:00 +0000" },
        { content: "blank date", created_at: "" },
      ])),
    }).fetchAnnotations("secret", selectedBook);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(orderAnnotations(result.value).map(({ text }) => text)).toEqual([
      "older absolute",
      "equal first",
      "equal second",
      "undated",
      "blank date",
    ]);
  });

  it.each([
    ["UnauthorizedError", new UnauthorizedError("unsafe"), "authentication"],
    ["a client error", new ApiError("bad request", { status: 400 }), "incomplete-data"],
    ["an unavailable error", new TypeError("offline"), "provider-unavailable"],
  ] as const)("preserves sanitized provider error categories for %s", async (_name, error, category) => {
    const result = await providerFor({ exportBookQuotes: () => Promise.reject(error) }).fetchAnnotations("secret-token", selectedBook);

    expect(result).toEqual({ ok: false, error: { category, providerId: "yandex-books" } });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("unsafe");
  });

  it.each([
    ["malformed CSV", "book_title,content\nbook,text"],
    ["a valid prefix followed by malformed CSV", `${csv([{ content: "valid" }])}bad"unterminated`],
  ])("fails completely for %s", async (_name, exportText) => {
    const result = await providerFor({ exportBookQuotes: () => Promise.resolve(exportText) })
      .fetchAnnotations("secret", selectedBook);

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
  });
});
