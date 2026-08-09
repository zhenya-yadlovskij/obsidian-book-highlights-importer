# ADR-0009: Require Obsidian 1.13 for Searchable Settings

- Status: accepted, supersedes ADR-0002
- Date: 2026-08-09
- Supersedes: ADR-0002

## Context and Problem Statement

ADR-0002 selected Obsidian SecretStorage for **Provider Credential** values and set Obsidian `1.11.4` as the minimum version. The plugin review requires settings search support, and `PluginSettingTab.getSettingDefinitions()` is available from Obsidian `1.13.0`. Supporting both platform versions would require separate imperative and declarative settings implementations.

## Considered Options

- Require Obsidian `1.13.0`, use declarative setting definitions, and retain SecretStorage for **Provider Credential** values.
- Retain Obsidian `1.11.4` support with parallel imperative and declarative settings implementations.
- Retain Obsidian `1.11.4` support without settings-search integration.

## Decision Outcome

Chosen option: "Require Obsidian `1.13.0`, use declarative setting definitions, and retain SecretStorage for Provider Credential values", because it satisfies the review requirement with one settings implementation while preserving the existing secret-storage boundary.

### Consequences

- Good, because users can find plugin configuration through Obsidian settings search.
- Good, because credential storage remains delegated to Obsidian SecretStorage rather than ordinary plugin data.
- Bad, because users on Obsidian `1.11.4` and `1.12.x` cannot install the `0.1.1` release.
- Bad, because dynamic configuration controls must be migrated to declarative definition renderers.
