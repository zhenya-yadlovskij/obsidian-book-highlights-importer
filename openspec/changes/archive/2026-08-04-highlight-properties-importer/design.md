## Context

The note service builds frontmatter from an **Import Snapshot**, then the
frontmatter module serializes plugin-owned values and merges them during
re-import. Its current `book-highlights-*` keys are both the generated metadata
and the persisted identity used to protect updates to a **Managed Book Note**.

```text
+-----------------+     +----------------------+     +-------------------+
| Import Snapshot | --> | Managed note service | --> | Frontmatter module |
+-----------------+     +----------------------+     +---------+---------+
                                                               |
                                                               v
                                                    +-----------------------+
                                                    | Managed Book Note      |
                                                    | bh-* + user properties |
                                                    +-----------------------+
```

The change must preserve the managed-section safety boundary in ADR-0004 and
does not affect provider or Obsidian adapter boundaries.

## Goals / Non-Goals

**Goals:**
- Write `bh-provider`, `bh-book-id`, `bh-title`, `bh-authors`, and
  `bh-imported-at` for new and re-imported notes.
- Omit status and source URL from generated frontmatter.
- Write the import time as a UTC ISO 8601 string compatible with an
  **Obsidian DateTime property**.
- Preserve user frontmatter and legacy `book-highlights-*` properties.
- Keep existing legacy notes eligible for safe re-import.

**Non-Goals:**
- Migrate, rename, or remove legacy `book-highlights-*` properties.
- Change book models, provider responses, managed-section markers, or note
  destination behavior.
- Add a frontmatter migration command or a dependency for YAML date handling.

## Decisions

### Make `bh-*` the current owned-property namespace

`ManagedFrontmatter` and its serializer will retain only the five required
values. The owned-key set used during merges will contain only those `bh-*`
keys, so re-import replaces current metadata while leaving legacy and user
properties untouched.

Alternative considered: treat both namespaces as owned and remove legacy keys.
This would leave notes cleaner, but conflicts with the requirement to not touch
existing `book-highlights-*` properties.

### Preserve legacy identity as a read fallback

Identity parsing will first use the complete `bh-provider` and `bh-book-id`
pair. When that pair is absent, it will read the legacy pair so a note created
by an earlier version can be safely re-imported. A partial or conflicting
identity remains invalid and continues to block writes.

Alternative considered: require the new pair immediately. This would prevent
safe re-import of persisted notes created before the namespace change.

### Serialize the import timestamp with `Date#toISOString`

The existing millisecond timestamp remains the internal value supplied by the
note service. Serialization converts it to a quoted UTC ISO 8601 string with
`new Date(importedAt).toISOString()`.

Alternative considered: store an unquoted YAML timestamp or retain Unix
milliseconds. Quoting keeps the existing serializer's scalar-safety behavior,
while ISO 8601 provides the requested Obsidian DateTime value.

## Risks / Trade-offs

- [Legacy and current properties can display different metadata] -> Preserve
  legacy values by request and document that only `bh-*` values are refreshed.
- [A malformed or partial identity could target the wrong note] -> Require a
  complete primary pair or complete legacy fallback pair; otherwise retain the
  existing safe destination-conflict behavior.
- [Older plugin versions ignore `bh-*` properties on rollback] -> They retain
  their existing legacy behavior; a later current-version re-import refreshes
  the `bh-*` properties again.

## Migration Plan

1. Release the new serializer and merge behavior together.
2. New imports create only `bh-*` metadata.
3. Re-imported notes retain legacy metadata, add or refresh `bh-*` metadata,
   and preserve user fields.
4. Rollback requires no data conversion because legacy metadata remains in
   place; `bh-*` properties remain as non-owned frontmatter for the prior
   version.

## Open Questions

None.
