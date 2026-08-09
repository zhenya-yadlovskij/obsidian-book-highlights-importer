# ADR Review Manifest

- Status: completed
- Review date: 2026-08-09

## Review Summary

ADR review completed for this change. The minimum-version decision in ADR-0002 is superseded because settings search requires Obsidian `1.13.0`; its SecretStorage decision is retained by ADR-0009.

## In-Force ADRs Reviewed

- ADR-0002: Store Provider Credentials in Obsidian SecretStorage, reviewed and superseded by ADR-0009.
- ADR-0003: Keep the Yandex Client Upstream-Owned.
- ADR-0004: Use Identity-Bearing Managed Sections.
- ADR-0005: Use a Hexagonal Application Core.
- ADR-0006: Register Providers at Compile Time.
- ADR-0007: Use Selected-Book Yandex Quote Exports.
- ADR-0008: Use `bh-*` Managed Note Properties.
- ADR-0009: Require Obsidian 1.13 for Searchable Settings.

## New Durable ADRs Created

- `adr/0009-require-obsidian-1-13-for-searchable-settings.md`: Requires Obsidian `1.13.0` for declarative searchable settings while retaining SecretStorage for provider credentials.
