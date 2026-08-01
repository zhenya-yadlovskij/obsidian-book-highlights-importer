# Yandex Provider Adapter Design

## Scope

Implement OpenSpec tasks 5.1 through 5.4. The adapter translates the supplied
`yandex-book-api-ts` client into the existing `ReadingProviderPort`; it does not
implement Obsidian storage, settings, or wizard UI.

## Structure

Add one `YandexBooksProvider` module with an injected factory that creates a
short-lived upstream client from a credential. The adapter exposes
`id: "yandex-books"`, display name `Yandex Books`, and `annotationFetch:
"early"`. It retains no credential or client after an operation completes.

The Obsidian startup composition will supply the existing
`createObsidianYandexClient` factory in a later task. Unit tests use small
in-memory upstream-client fakes instead of network requests.

## Credential Testing

`testCredential` calls `getProfile()`. It accepts only a profile with a
non-blank `login`. It maps unauthorized responses to `authentication`;
transport and unknown errors to `provider-unavailable`; malformed, rejected,
or blank-identity responses to `incomplete-data`. Results contain only the
existing safe error categories and never include the input credential or raw
provider error details.

## Library Pagination

`listBooks` requests offset pages with a fixed documented page size. It stops
only after a short page. It tracks normalized page signatures and output IDs,
then returns an `incomplete-data` failure on a repeated full page, a page with
no newly usable book, malformed data, or a safety-limit breach. Cards without
a stable text-book UUID are excluded. Only observed `reading` and `finished`
states map to `in-progress` and `finished`; all other values map to `unknown`.
No unverified reading-progress scale is inferred.

## Quote Pagination And Mapping

`fetchAnnotations` obtains a non-blank profile login, then requests account
quote pages with a fixed page size until a short page. It validates page
signatures and rejects all incomplete or ambiguous pagination outcomes rather
than returning a partial snapshot. Stable source keys deduplicate identical
records and reject conflicting values. Without a stable source key,
same-page identical records remain distinct, while an identical normalized
fingerprint crossing a page boundary is an ambiguous overlap and fails.

The adapter keeps only records for the selected book identity. An otherwise
importable record lacking `quote.book.uuid` fails the snapshot. It normalizes
line endings, strips unsupported markup, trims text, keeps highlight/comment
pairs together, and omits records with both values blank. It assigns stable
input indexes in source order.

## Tests And Completion

Each required behavior starts with a focused failing Vitest test using
sanitized values. Production code is then added minimally to make that test
pass. Tasks 5.1 through 5.4 are checked off only after the focused adapter
suite, type checking, linting, and the full test suite pass.
