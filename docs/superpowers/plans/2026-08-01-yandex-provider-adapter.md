# Yandex Provider Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a safe, fully paginated Yandex Books Provider Adapter for the existing provider-neutral import core.

**Architecture:** A new **Provider Adapter** in `src/providers/yandex.ts` wraps a fresh `YandexBookClient` created for each operation and implements `ReadingProviderPort`. It translates untrusted upstream records into the immutable core models, returning only existing safe provider error categories. A single fixture-driven test file supplies structural upstream-client fakes and proves every pagination guard before production code is introduced.

**Tech Stack:** TypeScript, Vitest, `yandex-book-api-ts` 0.0.2, existing core models/results/ports.

## Global Constraints

- Support Obsidian desktop and mobile on version `1.11.4` or newer.
- Use only the checked-in `yandex-book-api-ts-0.0.2.tgz`; do not patch, copy, or call provider endpoints outside that package.
- The adapter must implement the existing `ReadingProviderPort` from `src/core/ports.ts` and retain no **Provider Credential** after an operation completes.
- The adapter uses `getProfile().login` only for quotes; never fall back to numeric `profile.id` or `profile.uuid`.
- Use `PAGE_SIZE = 100` and `MAX_PAGES = 100`; a repeated full page, no-progress full page, malformed page, cross-page fingerprint overlap, or limit exhaustion returns `{ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } }` and never returns a prefix.
- `quote.itemUuid` is not a stable source key. Preserve identical records on one page and reject an identical normalized fingerprint that appears on a later page.
- Map only observed library states: `reading` to `in-progress`, `finished` to `finished`, and every other value to `unknown`. Do not map `readingProgress` until its scale is verified.
- Never expose raw credentials, upstream messages, or serialized upstream errors in a result, test failure output, or log.

---

## File Structure

- Create `src/providers/yandex.ts`: local upstream-client structural type, safe error mapper, normalization helpers, library and quote pagination, and `createYandexBooksProvider`.
- Create `tests/providers/yandex.test.ts`: all adapter behaviors using small in-memory client fakes and sanitized data.
- Modify `openspec/changes/obsidian-plugin-init/tasks.md`: check off 5.1 through 5.4 only after the focused suite and project verification pass.

### Task 1: Credential Test And Adapter Contract

**Files:**
- Create: `src/providers/yandex.ts`
- Create: `tests/providers/yandex.test.ts`

**Interfaces:**
- Consumes: `ReadingProviderPort`, `ProviderResult`, `failure`, and `ok` from `src/core/ports.ts`.
- Consumes: `YandexBookClient`, `ApiError`, and `UnauthorizedError` from `yandex-book-api-ts`.
- Produces: `createYandexBooksProvider(createClient: (credential: string) => YandexClient): ReadingProviderPort` with `id: "yandex-books"`, `displayName: "Yandex Books"`, and `annotationFetch: "early"`.

- [ ] **Step 1: Write the failing credential tests**

Create a local client fake with `getProfile`, `getMyLibrary`, and `getUserQuotes` methods. Add the following tests to `tests/providers/yandex.test.ts`:

```ts
it("accepts a profile with a non-blank login", async () => {
  const provider = createYandexBooksProvider(() => client({
    getProfile: async () => ({ login: "reader" }),
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
    getProfile: async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  }));

  const result = await provider.testCredential("secret-token");

  expect(result).toEqual({ ok: false, error: { category, providerId: "yandex-books" } });
  expect(JSON.stringify(result)).not.toContain("secret-token");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/providers/yandex.test.ts`

Expected: FAIL because `src/providers/yandex.ts` and `createYandexBooksProvider` do not exist.

- [ ] **Step 3: Implement the minimal credential path**

Create `src/providers/yandex.ts` with the structural client type and only the contract/error logic necessary for the tests:

```ts
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
```

Implement `testCredential` by constructing a client inside the method, calling `getProfile()`, trimming `login`, and returning `ok(undefined)` only for a non-empty value. Do not add logging or store the credential/client in a closure.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- tests/providers/yandex.test.ts`

Expected: PASS with each credential result containing only `category` and `providerId` on failure.

- [ ] **Step 5: Commit the credential contract**

```bash
git add src/providers/yandex.ts tests/providers/yandex.test.ts
git commit -m "Add Yandex credential validation"
```

### Task 2: Complete Library Pagination And Normalization

**Files:**
- Modify: `src/providers/yandex.ts`
- Modify: `tests/providers/yandex.test.ts`

**Interfaces:**
- Consumes: `createProviderBook` from `src/core/models.ts` and the `YandexClient` factory from Task 1.
- Produces: `listBooks(credential: string): Promise<ProviderResult<readonly ProviderBook[]>>`.

- [ ] **Step 1: Write failing library tests**

Add tests with `getMyLibrary` returning page arrays indexed by its `offset` argument. Cover these precise assertions:

```ts
it("advances offsets and stops after a short final page", async () => {
  const getMyLibrary = vi.fn()
    .mockResolvedValueOnce(fullPageOf(100, "reading"))
    .mockResolvedValueOnce([card("book-101", "finished")]);
  const result = await createYandexBooksProvider(() => client({ getMyLibrary })).listBooks("secret");

  expect(getMyLibrary).toHaveBeenNthCalledWith(1, 100, 0);
  expect(getMyLibrary).toHaveBeenNthCalledWith(2, 100, 100);
  expect(result).toEqual({ ok: true, value: expect.arrayContaining([
    expect.objectContaining({ bookId: "book-1", status: "in-progress" }),
    expect.objectContaining({ bookId: "book-101", status: "finished" }),
  ]) });
});

it.each([
  ["repeats a full page", [fullPageOf(100), fullPageOf(100)]],
  ["receives no usable books in a full page", [fullPageWithoutTextBookIds(100)]],
  ["reaches the page limit", Array.from({ length: 101 }, () => fullPageOf(100))],
])("rejects incomplete library data when it %s", async (_name, pages) => {
  const result = await createYandexBooksProvider(() => client({
    getMyLibrary: async (_limit, offset) => pages[(offset ?? 0) / 100] ?? [],
  })).listBooks("secret");

  expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
});
```

Add a malformed non-array runtime response test, a card-without-`book.uuid` exclusion test, and state assertions proving `pending` is `unknown` and no `progress` property is supplied from `readingProgress`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/providers/yandex.test.ts`

Expected: FAIL because `listBooks` is a placeholder or does not paginate and normalize the fake cards.

- [ ] **Step 3: Implement minimal library pagination**

Add these constants and validate all untrusted runtime values before reading fields:

```ts
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

const libraryStatus = (state: unknown): "in-progress" | "finished" | "unknown" => {
  const normalized = typeof state === "string" ? state.trim().toLowerCase() : "";
  if (normalized === "reading") return "in-progress";
  if (normalized === "finished") return "finished";
  return "unknown";
};
```

For each page, require `Array.isArray(page)`. Build a deterministic page signature from the normalized raw card values, reject a repeated full-page signature, and collect only cards whose `book.uuid` is a non-blank string. Reject a full page that contributes no new normalized book ID; stop and return immutable `ProviderBook` values only when `page.length < PAGE_SIZE`. Call `createProviderBook` with the canonical status from `libraryStatus` and omit `progress`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- tests/providers/yandex.test.ts`

Expected: PASS; the implementation never returns a partial library after any guard fails.

- [ ] **Step 5: Commit the library implementation**

```bash
git add src/providers/yandex.ts tests/providers/yandex.test.ts
git commit -m "Add Yandex library pagination"
```

### Task 3: Complete Quote Pagination With Fingerprint Safeguards

**Files:**
- Modify: `src/providers/yandex.ts`
- Modify: `tests/providers/yandex.test.ts`

**Interfaces:**
- Consumes: the per-operation `YandexClient` and `PAGE_SIZE`/`MAX_PAGES` from prior tasks.
- Produces: complete raw quote pages only for the current operation; no partial `BookAnnotation` collection reaches the caller.

- [ ] **Step 1: Write failing quote-pagination tests**

Add tests that provide a profile login and page-indexed `getUserQuotes` fake. Assert exact page calls and all failure guards:

```ts
it("uses the authenticated profile login and stops after a short quote page", async () => {
  const getUserQuotes = vi.fn()
    .mockResolvedValueOnce(fullQuotePageOf(100, "book-1"))
    .mockResolvedValueOnce([quote({ bookId: "book-1", content: "last" })]);
  const result = await providerFor({ getUserQuotes }).fetchAnnotations("secret", selectedBook);

  expect(getUserQuotes).toHaveBeenNthCalledWith(1, "reader", 1, 100);
  expect(getUserQuotes).toHaveBeenNthCalledWith(2, "reader", 2, 100);
  expect(result).toEqual({ ok: true, value: expect.any(Array) });
});

it("preserves identical records on one page", async () => {
  const duplicate = quote({ bookId: "book-1", content: "same" });
  const result = await providerFor({ getUserQuotes: async () => [duplicate, duplicate] })
    .fetchAnnotations("secret", selectedBook);
  expect(result).toEqual({ ok: true, value: expect.arrayContaining([
    expect.objectContaining({ inputIndex: 0 }),
    expect.objectContaining({ inputIndex: 1 }),
  ]) });
});

it.each([
  ["a repeated full page", [fullQuotePageOf(100, "book-1"), fullQuotePageOf(100, "book-1")]],
  ["a cross-page fingerprint overlap", [fullQuotePageOf(100, "book-1"), [quote({ bookId: "book-1", content: "quote-1" })]]],
  ["a malformed page", [{}]],
  ["the page limit", Array.from({ length: 101 }, () => fullQuotePageOf(100, "book-1"))],
])("fails rather than returning a partial snapshot on %s", async (_name, pages) => {
  const result = await providerFor({
    getUserQuotes: async (_login, page) => pages[(page ?? 1) - 1],
  }).fetchAnnotations("secret", selectedBook);
  expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
});
```

Also test missing/blank profile login and a full page with no new normalized fingerprint. Each must fail as `incomplete-data` without making a note-related call.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/providers/yandex.test.ts`

Expected: FAIL because `fetchAnnotations` does not yet perform profile lookup, page validation, or fingerprint overlap checks.

- [ ] **Step 3: Implement quote page collection before mapping**

Fetch and validate a non-blank profile login. For each page, require an array; create a normalized fingerprint from owning book UUID, normalized content/comment, CFI/XPath/offset fields, progress, and creation time. Preserve duplicate fingerprints inside the current page. Before accepting a page, reject its full-page signature if seen; reject any fingerprint already accepted from an earlier page; reject a full page that adds no new fingerprint; and fail after `MAX_PAGES` full pages. Return the accumulated raw records to a private mapping function only after a short page completes the sequence.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- tests/providers/yandex.test.ts`

Expected: PASS; `quote.itemUuid` never appears in source-key or deduplication logic.

- [ ] **Step 5: Commit quote pagination**

```bash
git add src/providers/yandex.ts tests/providers/yandex.test.ts
git commit -m "Add guarded Yandex quote pagination"
```

### Task 4: Quote Mapping, Sanitization, And OpenSpec Completion

**Files:**
- Modify: `src/providers/yandex.ts`
- Modify: `tests/providers/yandex.test.ts`
- Modify: `openspec/changes/obsidian-plugin-init/tasks.md`

**Interfaces:**
- Consumes: complete raw quote records from Task 3 and `createBookAnnotation` from `src/core/models.ts`.
- Produces: `fetchAnnotations(credential, book): Promise<ProviderResult<readonly BookAnnotation[]>>` that returns only the selected book's importable annotations.

- [ ] **Step 1: Write failing mapping tests**

Add direct assertions for each selection/mapping rule:

```ts
it("maps selected-book highlights and comments with sanitized text", async () => {
  const result = await providerFor({
    getUserQuotes: async () => [
      quote({ bookId: "book-1", content: "<b> Highlight </b>\r\ntext", comment: " Note " }),
      quote({ bookId: "other-book", content: "ignore" }),
    ],
  }).fetchAnnotations("secret", selectedBook);

  expect(result).toEqual({ ok: true, value: [{
    text: "Highlight \ntext",
    comment: "Note",
    progress: expect.any(Number),
    inputIndex: 0,
  }] });
});

it("rejects an importable quote without an owning book identity", async () => {
  const result = await providerFor({
    getUserQuotes: async () => [quote({ bookId: undefined, content: "unowned" })],
  }).fetchAnnotations("secret", selectedBook);
  expect(result).toEqual({ ok: false, error: { category: "incomplete-data", providerId: "yandex-books" } });
});

it("excludes a quote only when both highlight and comment are blank", async () => {
  const result = await providerFor({
    getUserQuotes: async () => [
      quote({ bookId: "book-1", content: " ", comment: " " }),
      quote({ bookId: "book-1", comment: "comment-only" }),
    ],
  }).fetchAnnotations("secret", selectedBook);
  expect(result).toEqual({ ok: true, value: [expect.objectContaining({ comment: "comment-only" })] });
});
```

Add assertions that `sourceKey`, location, and unverified reading-progress fields are absent; use `createdAt` only when it is finite; and ensure the result JSON contains neither the credential nor unsafe provider text from a thrown error.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/providers/yandex.test.ts`

Expected: FAIL because completed quote pages are not yet mapped to `BookAnnotation` values.

- [ ] **Step 3: Implement minimal quote mapping**

Implement a private `sanitizeText(value: unknown): string | undefined` that accepts strings only, converts CRLF/CR to LF, removes tag-shaped markup with `/<[^>]*>/g`, trims, and returns `undefined` when blank. For each collected quote, sanitize content and comment first. Ignore a non-importable record before checking its book identity. For an importable record, require a non-blank `book.uuid`; fail the whole result if missing; skip it when the UUID differs from `book.bookId`; otherwise call `createBookAnnotation` with text/comment, a finite numeric `progress`, a finite numeric `createdAt`, and the source-order `inputIndex`. Do not set `sourceKey`, `location`, or `sectionPath`.

- [ ] **Step 4: Run focused and project verification**

Run in order:

```bash
npm test -- tests/providers/yandex.test.ts
npm run typecheck
npm run lint
npm test
```

Expected: all commands exit zero with no warnings. If a test exposes an adapter failure, add a focused failing regression test first, then make the smallest correction.

- [ ] **Step 5: Mark the OpenSpec tasks complete and commit**

After the verification commands pass, change only these task checkboxes:

```md
- [x] 5.1 Implement Yandex credential testing ...
- [x] 5.2 Implement complete library pagination ...
- [x] 5.3 Implement complete quote pagination ...
- [x] 5.4 Map only records belonging to the selected book ...
```

Then commit the completed slice:

```bash
git add src/providers/yandex.ts tests/providers/yandex.test.ts openspec/changes/obsidian-plugin-init/tasks.md
git commit -m "Implement Yandex provider adapter"
```

## Plan Review

**Spec coverage:** Task 1 covers 5.1 safe credential testing. Task 2 covers 5.2 complete library pagination, missing text-book IDs, and proven normalization. Tasks 3 and 4 cover 5.3 and 5.4 complete quote pagination, safe cross-page handling, selected-book filtering, missing ownership identity, sanitization, pairing, and blank exclusion.

**Placeholder scan:** No incomplete instruction or unspecified validation remains. Constants, error categories, commands, interfaces, and test conditions are explicit.

**Type consistency:** Every public production method is the existing `ReadingProviderPort` method. The factory returns `ReadingProviderPort`; later composition can supply the existing `createObsidianYandexClient` as its client factory.
