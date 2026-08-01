# ADR-0001: Use Hexagonal Provider Architecture

- Status: accepted
- Date: 2026-07-31
- Supersedes: none

## Context and Problem Statement

The plugin must support multiple **Reading Providers** over time while keeping provider APIs, Obsidian UI, credential storage, and vault operations from defining shared import behavior. Yandex Books is first, but later providers must reuse configuration, selection, rendering, and note-safety behavior without copying the workflow.

## Considered Options

- A hexagonal application core with ports, built-in **Provider Adapters**, and a compile-time **Provider Registry**
- Layered services that call Obsidian and provider clients directly
- Provider-owned vertical slices that each implement settings, workflow, and rendering
- Runtime third-party provider loading

## Decision Outcome

Chosen option: "A hexagonal application core with ports, built-in Provider Adapters, and a compile-time Provider Registry", because it keeps the reusable import use cases and models independent of both Obsidian and provider-specific packages while avoiding a premature public extension API.

### Consequences

- Good, because future built-in providers can reuse the same import and note behavior through narrow provider contracts.
- Good, because core behavior can be tested without Obsidian or live network access.
- Bad, because the initial implementation requires explicit ports, adapters, and startup wiring.
- Bad, because third-party providers cannot be loaded without a plugin release and a future architectural decision.
