import { ApiError, UnauthorizedError } from "yandex-book-api-ts";
import { describe, expect, it, vi } from "vitest";
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
  readonly book: { readonly uuid: string };
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

  it.each<readonly [string, readonly (readonly unknown[])[]]>([
    ["repeats a full page", [fullPageOf(100), fullPageOf(100)]],
    ["receives no usable books in a full page", [fullPageWithoutTextBookIds(100)]],
    ["reaches the page limit", Array.from({ length: 101 }, () => fullPageOf(100))],
  ])("rejects incomplete library data when it %s", async (_name, pages) => {
    const result = await createYandexBooksProvider(() => client({
      getMyLibrary: (_limit, offset) => Promise.resolve(pages[(offset ?? 0) / 100] ?? []),
    })).listBooks("secret");

    expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
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
