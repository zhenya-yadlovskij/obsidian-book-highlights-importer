# Obsidian Publishing Fixes Design

## Goal

Prepare a corrected `0.1.1` release that resolves every error and warning reported by the Obsidian plugin review. Artifact attestations and release-asset cleanup are intentionally out of scope because they were recommendations rather than warnings.

## Release Metadata

- Change the manifest description so it does not contain the word "Obsidian".
- Raise the minimum supported Obsidian version from `1.11.4` to `1.13.0`, which permits the declarative settings API.
- Update manifest, version metadata, and package metadata from `0.1.0` to `0.1.1`.
- Manually publish the resulting GitHub release with a name that includes `0.1.1`.

## Settings Search

`BookHighlightsSettingsTab` will implement `getSettingDefinitions()` and expose every current user-facing setting through declarative definitions. The tab will retain the current dynamic provider controls and asynchronous rendering through definition renderers, preserving credential redaction, connection-test freshness checks, folder suggestions, and debounced default-folder persistence while making the controls discoverable in Obsidian settings search.

## Source Compatibility

- Replace the review-listed generic DOM construction in the import modal and folder suggestion with the specific Obsidian `createDiv` helper.
- Replace the OAuth external-link DOM construction with an anchor created through an Obsidian-managed element helper.
- Use `window.setTimeout` and `window.clearTimeout` for default-folder debounce timers, so timers run in the active Obsidian window.

## Verification

- Update and extend unit tests for declarative settings definitions and the preserved settings behavior.
- Run `npm run check` to validate types, linting, tests, the production build, and release metadata.
- Publish the `0.1.1` release with a version-bearing name and submit it to the Obsidian review. Success requires a fresh review with no errors or warnings.

## Out Of Scope

- GitHub artifact attestations for release assets.
- Removing `versions.json` from release assets.
- Release automation.
