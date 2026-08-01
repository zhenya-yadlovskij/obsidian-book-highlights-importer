# ADR-0005: Use a Hexagonal Application Core

- Status: accepted, supersedes ADR-0001
- Date: 2026-07-31
- Supersedes: ADR-0001

## Context and Problem Statement

ADR-0001 combined the application architecture with the independent provider-extension policy. This record replaces its architecture portion while leaving the original file immutable. Shared import behavior must remain independent of Obsidian APIs and **Reading Provider** packages as both evolve.

## Considered Options

- A hexagonal application core with ports and **Provider Adapters**
- Layered services that call Obsidian and provider clients directly
- Provider-owned vertical slices that each implement the full workflow

## Decision Outcome

Chosen option: "A hexagonal application core with ports and Provider Adapters", because dependency inversion keeps reusable import policy and normalized models independent of external runtimes and packages.

### Consequences

- Good, because core behavior can be tested without Obsidian or network access.
- Good, because future providers share import, rendering, and note-safety behavior through narrow ports.
- Bad, because the initial plugin requires explicit ports, adapters, and startup wiring.
- Bad, because maintainers must preserve dependency direction when adding integrations.
