# ADR-0003: Keep the Yandex Client Upstream-Owned

- Status: accepted
- Date: 2026-07-31
- Supersedes: none

## Context and Problem Statement

The supplied `yandex-book-api-ts` package already encapsulates the unofficial Yandex Books API. Its current runtime compatibility with Obsidian desktop and mobile is not yet proven, and maintaining duplicate endpoint behavior inside the plugin would create two sources of truth.

## Considered Options

- Consume the supplied package and require compatibility fixes in its upstream source
- Call Yandex endpoints directly from the plugin
- Vendor or fork the package source into this repository
- Patch the compiled package during the plugin build

## Decision Outcome

Chosen option: "Consume the supplied package and require compatibility fixes in its upstream source", because package ownership, API mapping, and transport behavior remain in one maintained library while the plugin's **Provider Adapter** stays a translation boundary.

### Consequences

- Good, because Yandex endpoint and model maintenance remains centralized in the dedicated package.
- Good, because the plugin does not depend on fragile build-time patches or copied private API behavior.
- Bad, because a package incompatibility blocks dependent plugin implementation until a replacement package is supplied.
- Bad, because desktop and mobile compatibility spikes are release gates rather than optional checks.
