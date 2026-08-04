## 1. Update Managed Frontmatter

- [ ] 1.1 Replace the generated `book-highlights-*` key set with
  `bh-provider`, `bh-book-id`, `bh-title`, `bh-authors`, and
  `bh-imported-at`; remove status and source URL from `ManagedFrontmatter`.
- [ ] 1.2 Serialize `bh-imported-at` as a quoted UTC ISO 8601 value and update
  merge ownership so only current `bh-*` keys are replaced.
- [ ] 1.3 Parse a complete `bh-provider` and `bh-book-id` pair as the primary
  note identity, with a complete legacy pair as the fallback, and reject
  partial or conflicting identities.

## 2. Integrate And Test

- [ ] 2.1 Update the managed note service to construct the reduced frontmatter
  metadata while retaining the existing book model and managed-section checks.
- [ ] 2.2 Update frontmatter unit tests to cover the new property names,
  omitted status and source URL, ISO timestamp, current-key replacement, and
  legacy-key preservation.
- [ ] 2.3 Update managed note service tests to verify that a legacy note can be
  re-imported, retains its `book-highlights-*` metadata, and receives refreshed
  `bh-*` metadata.

## 3. Verify The Change

- [ ] 3.1 Run `npm test -- tests/notes/frontmatter.test.ts tests/notes/service.test.ts`.
- [ ] 3.2 Run `npm run check`.
- [ ] 3.3 Run `openspec validate highlight-properties-importer --type change --strict` before archive.
