## Why

Generated **Managed Book Note** metadata uses a long property prefix, includes
unneeded status and source URL fields, and stores the import time as a numeric
timestamp that Obsidian does not recognize as a DateTime property. Simplifying
this metadata makes generated notes easier to use in Obsidian property views.

## What Changes

- **BREAKING** Generate book metadata with the `bh-` prefix instead of
  `book-highlights-`.
- Generate only provider, book ID, title, authors, and import-time metadata;
  omit status and source URL properties.
- Serialize `bh-imported-at` as a UTC ISO 8601 DateTime value.
- On re-import, update only `bh-*` properties and leave legacy
  `book-highlights-*` properties unchanged.

## Capabilities

### New Capabilities
- `managed-note-properties`: Define generated book-property names, values, and
  re-import ownership for a Managed Book Note.

### Modified Capabilities

None.

## Impact

Changes the managed frontmatter serializer and merge behavior, its metadata
model, and note-frontmatter tests. Existing **Managed Book Note** content and
legacy `book-highlights-*` properties remain intact.
