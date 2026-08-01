# ADR-0004: Use Identity-Bearing Managed Sections

- Status: accepted
- Date: 2026-07-31
- Supersedes: none

## Context and Problem Statement

Re-import must refresh a complete **Import Snapshot** without deleting user-authored Markdown or unrelated frontmatter. The plugin also needs to reject unrelated or ambiguous files and preserve a stable persisted contract for future providers and plugin versions.

## Considered Options

- Namespaced frontmatter plus one versioned, identity-bearing **Managed Section** per **Managed Book Note**
- Overwrite the complete destination note
- Append a new generated block on every import
- Merge annotations individually by provider record ID

## Decision Outcome

Chosen option: "Namespaced frontmatter plus one versioned, identity-bearing Managed Section per Managed Book Note", because it gives the plugin an explicit ownership boundary while preserving all user-owned content and allowing complete-snapshot replacement when stable per-annotation IDs are unavailable.

### Consequences

- Good, because re-import can remove stale provider annotations without duplicating generated content.
- Good, because user-authored body content and non-namespaced frontmatter remain outside plugin ownership.
- Bad, because malformed, unsupported, or mismatched markers must block updates instead of being repaired heuristically.
- Bad, because marker versions and namespaced frontmatter become persisted compatibility contracts for future releases.
- Bad, because YAML serialization may normalize formatting even though user-owned values are preserved.
