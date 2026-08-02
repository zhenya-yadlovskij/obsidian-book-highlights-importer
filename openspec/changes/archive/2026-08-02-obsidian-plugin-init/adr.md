# ADR Review Manifest

- Status: completed
- Review date: 2026-07-31

## Review Summary

ADR review completed for this change. Five current decisions establish long-term application architecture, provider registration, security, dependency ownership, and persisted note contracts that future changes must honor. ADR-0001 was preserved and superseded during review because it originally bundled architecture and provider-registration policy.

## In-Force ADRs Reviewed

- None - `<repo>/adr/` had no in-force ADRs before this review.

## New Durable ADRs Created

- `adr/0001-use-hexagonal-provider-architecture.md`
- `adr/0002-store-provider-credentials-in-obsidian-secretstorage.md`
- `adr/0003-keep-yandex-client-upstream-owned.md`
- `adr/0004-use-identity-bearing-managed-sections.md`
- `adr/0005-use-hexagonal-application-core.md` - supersedes the architecture portion of ADR-0001
- `adr/0006-register-providers-at-compile-time.md` - supersedes the provider-registration portion of ADR-0001
