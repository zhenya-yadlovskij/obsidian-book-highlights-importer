# ADR-0008: Use `bh-*` Managed Note Properties

- Status: accepted
- Date: 2026-08-04
- Supersedes: none

## Context and Problem Statement

The namespaced frontmatter on a **Managed Book Note** is a persisted ownership
and compatibility contract. The existing `book-highlights-*` namespace is
verbose, includes fields that are not needed in Obsidian property views, and
stores imports as Unix milliseconds rather than a DateTime value.

## Considered Options

- Use `bh-*` as the current generated-property namespace while preserving
  legacy `book-highlights-*` properties unchanged.
- Retain the existing `book-highlights-*` namespace.
- Rename or remove legacy properties during re-import.

## Decision Outcome

Chosen option: "Use `bh-*` as the current generated-property namespace while
preserving legacy `book-highlights-*` properties unchanged", because it
shortens generated property names while retaining the user-requested legacy
metadata and the safe re-import compatibility of existing notes.

### Consequences

- Good, because generated notes expose a concise, consistent current metadata
  contract.
- Good, because existing notes remain eligible for safe re-import without
  altering legacy properties.
- Bad, because re-imported legacy notes can display both current and legacy
  metadata with different values.
- Bad, because future metadata changes must preserve the current `bh-*`
  namespace or be recorded as a new compatibility decision.
