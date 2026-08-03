# ADR-0007: Use Selected-Book Yandex Quote Exports

- Status: accepted
- Date: 2026-08-03
- Supersedes: none

## Context and Problem Statement

The Yandex Books **Provider Adapter** needs a complete set of annotations for one selected book. Account-wide `getUserQuotes()` pagination requires profile identity, cross-book filtering, overlap detection, and a page limit before it can produce a trustworthy **Import Snapshot**. The upstream `yandex-book-api-ts` client now exposes a selected-book CSV export, but adopting it requires choosing whether that export is authoritative or merely the first of multiple retrieval paths.

## Considered Options

- Use the selected-book CSV export as the sole annotation source and fail if it cannot produce a complete snapshot
- Prefer the selected-book export but fall back to account-wide quote pagination
- Retain account-wide quote pagination and ignore the selected-book export

## Decision Outcome

Chosen option: "Use the selected-book CSV export as the sole annotation source and fail if it cannot produce a complete snapshot", because one book-scoped upstream operation removes account-wide pagination ambiguity while preserving the plugin's all-or-nothing **Import Snapshot** contract.

The **Provider Adapter** will parse the complete export before returning **Book Annotation** records. Missing required columns, malformed CSV, or an upstream export failure will fail the import without returning a valid prefix. Additive columns remain compatible. The adapter will not call `getUserQuotes()` as a fallback.

### Consequences

- Good, because annotation retrieval requests only the selected book and no longer depends on profile login, page limits, overlap fingerprints, or cross-book filtering.
- Good, because endpoint ownership remains in the upstream client while provider-specific CSV mapping stays within the adapter boundary established by ADR-0003 and ADR-0005.
- Good, because complete **Managed Section** replacement remains safe when the export provides no stable per-annotation identifiers, as established by ADR-0004.
- Bad, because an unavailable or malformed export blocks the import even when account-wide quotes might still be reachable.
- Bad, because the plugin must maintain strict parsing for the upstream CSV contract and hold one selected book's export in memory.
- Bad, because the absence of source identifiers continues to preclude incremental per-annotation synchronization.
- Follow-up: Maintain a synthetic export fixture and desktop/mobile compatibility gates for the selected-book text endpoint.
