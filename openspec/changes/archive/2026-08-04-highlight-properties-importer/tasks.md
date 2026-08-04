## 1. Update Managed Frontmatter

- [x] 1.1 Replace the generated `book-highlights-*` key set with
  `bh-provider`, `bh-book-id`, `bh-title`, `bh-authors`, and
  `bh-imported-at`; remove status and source URL from `ManagedFrontmatter`.
- [x] 1.2 Serialize `bh-imported-at` as a quoted UTC ISO 8601 value and update
  merge ownership so only current `bh-*` keys are replaced.
- [x] 1.3 Parse a complete `bh-provider` and `bh-book-id` pair as the primary
  note identity, with a complete legacy pair as the fallback, and reject
  partial or conflicting identities.

## 2. Integrate And Test

- [x] 2.1 Update the managed note service to construct the reduced frontmatter
  metadata while retaining the existing book model and managed-section checks.
- [x] 2.2 Update frontmatter unit tests to cover the new property names,
  omitted status and source URL, ISO timestamp, current-key replacement, and
  legacy-key preservation.
- [x] 2.3 Update managed note service tests to verify that a legacy note can be
  re-imported, retains its `book-highlights-*` metadata, and receives refreshed
  `bh-*` metadata.

## 3. Verify The Change

- [x] 3.1 Run `npm test -- tests/notes/frontmatter.test.ts tests/notes/service.test.ts`.
- [x] 3.2 Run `npm run check`.
- [x] 3.3 Run `openspec validate highlight-properties-importer --type change --strict` before archive.
