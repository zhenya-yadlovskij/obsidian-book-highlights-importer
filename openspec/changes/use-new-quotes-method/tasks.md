## 1. Upgrade the Upstream Package and Establish the Fixture

- [x] 1.1 Add `yandex-book-api-ts-0.0.3.tgz`, update `package.json` and `package-lock.json` from the 0.0.2 local archive to 0.0.3, run `npm install`, and verify the lockfile changes only the intended package reference and exposes `exportBookQuotes(bookId, "csv")`.
- [x] 1.2 Create `tests/fixtures/yandex/book-quotes-export.csv` with entirely synthetic book metadata, highlights, and comments while preserving the six observed headers and examples of Unicode, quoted commas, doubled quotes, an embedded newline, an empty comment, `blue` and `yellow` colors, equal timestamps, and numeric timezone offsets; verify no text from the user-supplied export is present.

## 2. Build the Provider-Local CSV Parser with TDD

- [x] 2.1 Add failing tests in `tests/providers/yandex-quotes-csv.test.ts` for a `parseYandexQuoteCsv(value: string)` interface that reads the synthetic fixture and covers LF, CRLF, an optional UTF-8 byte-order mark, quoted commas, doubled quotes, embedded newlines, empty fields, a trailing record terminator, and additive columns.
- [x] 2.2 Extend the failing parser tests to reject an empty or malformed header, missing or duplicate required headers, invalid quote transitions, unterminated quotes after valid records, and field-count mismatches without returning a valid prefix.
- [x] 2.3 Implement `src/providers/yandex-quotes-csv.ts` as a dependency-free RFC 4180-style state machine that returns immutable rows only after complete structural validation, then run `npm test -- tests/providers/yandex-quotes-csv.test.ts` and confirm all parser tests pass.
- [x] 2.4 Add failing tests for `parseYandexQuoteCreatedAt(value: string)` covering valid `YYYY-MM-DD HH:mm:ss +HHMM` values, equivalent instants with different offsets, invalid calendar components, invalid offsets, and blank values; implement explicit epoch-second conversion without locale-dependent parsing and rerun the targeted parser tests.

## 3. Migrate the Yandex Provider Adapter with TDD

- [x] 3.1 Replace account-wide quote fakes in `tests/providers/yandex.test.ts` with `exportBookQuotes` fakes and add failing assertions that `fetchAnnotations()` calls `exportBookQuotes(selectedBook.bookId, "csv")` exactly once, does not require profile login, does not fall back to `getUserQuotes()`, and preserves existing sanitized provider-error categories.
- [x] 3.2 Add failing provider tests for content/comment mapping, comment-only and blank rows, Unicode and multiline text, library metadata authority, ignored colors, absent progress and source keys, preserved identical rows, and all-or-nothing failure for malformed exports or missing required columns.
- [x] 3.3 Add failing chronological tests that pass mapped annotations through shared ordering and prove absolute-time oldest-first order, export order for equal timestamps, and dated-before-undated order with invalid or blank timestamps.
- [x] 3.4 Update `YandexClient` and `src/providers/yandex.ts` to use the parser and selected-book export, map valid rows to immutable **Book Annotation** records, and remove obsolete quote pagination, fingerprint, profile-login, cross-book filtering, and page-limit code while retaining `getProfile()` for credential testing.
- [x] 3.5 Run `npm test -- tests/providers/yandex.test.ts tests/providers/yandex-quotes-csv.test.ts tests/core/annotations.test.ts` and `npm run typecheck`; resolve failures without weakening complete **Import Snapshot** semantics.

## 4. Update Obsidian and Runtime Compatibility Coverage

- [x] 4.1 Update `tests/obsidian/yandex-client.integration.test.ts` with a failing text-response case for `/profile/books/<book-id>/quotes_export?format=csv`, then verify `createObsidianYandexClient()` returns the exact CSV text through the injected `requestUrl()` transport.
- [x] 4.2 Update `tests/compatibility/yandex-runtime.test.ts` first, then `src/compatibility/yandex-runtime.ts`, so the harness selects a library card with a non-blank book ID, calls `exportBookQuotes(bookId, "csv")`, parses the complete export, reports only sanitized row/importable counts and structural status, and fails safely when no usable book or valid export is available.
- [x] 4.3 Update `src/obsidian/runtime-compatibility-modal.ts` and `tests/obsidian/runtime-compatibility-modal.test.ts` so package-compatibility copy and result fixtures describe a selected-book quote export rather than account-wide quotes.
- [x] 4.4 Update `scripts/yandex-smoke.mjs` and `tests/compatibility/yandex-smoke.test.ts` to load the library, choose a book with an ID, call `exportBookQuotes(bookId, "csv")`, report no response content, and exit unsuccessfully on library, identity, or export failure.
- [x] 4.5 Run `npm test -- tests/obsidian/yandex-client.integration.test.ts tests/obsidian/runtime-compatibility-modal.test.ts tests/compatibility/yandex-runtime.test.ts tests/compatibility/yandex-smoke.test.ts` and confirm credentials, provider text, book metadata, highlights, and comments never appear in diagnostics.

## 5. Verify the Complete Change

- [x] 5.1 Run `npm run check` and resolve every typecheck, lint, unit-test, build, and release-verification failure without adding an account-wide quote fallback or a new CSV dependency.
- [x] 5.2 Run `openspec validate use-new-quotes-method --type change --strict` and confirm the implementation still satisfies selected-book retrieval, additive-column compatibility, complete-failure behavior, chronological ordering, duplicate preservation, and absent fabricated identifiers.
- [ ] 5.3 Run sanitized Yandex compatibility checks on supported Obsidian desktop and mobile runtimes with package 0.0.3, then append only version, status, and aggregate structural/count evidence to `tests/fixtures/yandex/runtime-observations.json`; do not record tokens, book metadata, CSV content, highlights, or comments.
- [x] 5.4 Inspect the final diff to confirm the synthetic CSV is the only quote-export document added, the real user export and credentials are absent, the 0.0.3 archive is included intentionally, and every implementation file is covered by the targeted or full verification commands.
