# ADR-0006: Register Providers at Compile Time

- Status: accepted, supersedes ADR-0001
- Date: 2026-07-31
- Supersedes: ADR-0001

## Context and Problem Statement

ADR-0001 combined the application architecture with the independent provider-extension policy. This record replaces its extension-policy portion while leaving the original file immutable. The plugin needs a clear way to discover built-in providers, but the first release has no requirement for third-party runtime loading or a public compatibility contract.

## Considered Options

- An immutable compile-time **Provider Registry** populated by plugin startup wiring
- Runtime loading of third-party provider packages
- Hard-code one provider directly into settings and the import wizard

## Decision Outcome

Chosen option: "An immutable compile-time Provider Registry populated by plugin startup wiring", because it supports multiple built-in providers without introducing trust, versioning, and dynamic-loading contracts before they are needed.

### Consequences

- Good, because settings and the import wizard discover providers from one consistent registry.
- Good, because provider code ships and is verified with the plugin release.
- Bad, because adding a provider requires a plugin update.
- Bad, because a future third-party adapter ecosystem requires a new decision and compatibility model.
