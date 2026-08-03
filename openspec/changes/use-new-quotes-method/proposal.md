## Why

The Yandex Books **Provider Adapter** currently retrieves account-wide quote pages, applies pagination safeguards, and filters them to the selected book. Version 0.0.3 of the upstream client provides a per-book CSV export, allowing the adapter to request a complete, book-scoped **Import Snapshot** directly and avoid fragile account-wide pagination.

## What Changes

- Upgrade `yandex-book-api-ts` from version 0.0.2 to 0.0.3.
- Replace profile lookup and paginated `getUserQuotes()` calls with `exportBookQuotes(bookId, "csv")`; do not retain the old method as a fallback.
- Require the six observed CSV fields while tolerating additional columns, and parse the complete export safely, including quoted commas, escaped quotes, embedded newlines, Unicode text, empty comments, and timezone-bearing creation timestamps.
- Map exported content and comments to **Book Annotation** records, order dated annotations from oldest to newest, preserve export order for equal timestamps, and place undated annotations afterward.
- Keep library book metadata authoritative, ignore highlight color for now, and do not synthesize quote identifiers that Yandex Books does not provide.
- Reject malformed exports as incomplete data rather than producing a partial import.
- Add a synthetic CSV fixture that documents the observed Yandex Books export fields and edge cases without including real user data.

## Capabilities

### New Capabilities

- `yandex-book-quote-import`: Retrieve and safely parse a selected Yandex Books book's CSV quote export into a complete, chronologically ordered annotation snapshot.

### Modified Capabilities

None.

## Impact

- Affects the Yandex Books **Provider Adapter**, its upstream client contract, quote parsing and mapping tests, runtime compatibility checks, and synthetic test fixtures.
- Removes the adapter's dependency on profile login and account-wide quote pagination during annotation retrieval.
- Preserves current managed-note replacement behavior; the lack of stable quote identifiers continues to preclude incremental per-annotation synchronization but does not affect current imports.
