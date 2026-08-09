## Why

The Obsidian plugin review rejected the current release because its manifest description includes the word "Obsidian" and reported warnings for release metadata and API usage. Addressing those findings in a patch release is required before resubmission and will make the plugin configuration searchable in supported Obsidian versions.

## What Changes

- Prepare patch release `0.1.1` with a compliant manifest description, matching version metadata, and minimum app version `1.13.0`.
- Require a manually published GitHub release whose name includes `0.1.1`.
- Replace every review-listed DOM construction site with the appropriate Obsidian element helper and use active-window timeout APIs for default-folder persistence.
- Migrate plugin settings to declarative definitions so the default folder, **Yandex OAuth token** guidance, and provider controls appear in Obsidian settings search while preserving current configuration behavior.
- Preserve **Provider Credential** secrecy, connection-test race protection, folder suggestions, delayed saves, and Yandex OAuth browser authorization behavior.
- Leave artifact attestations, release-asset cleanup, and release automation out of scope because the review classified them as recommendations rather than warnings.

## Capabilities

### New Capabilities
- `community-plugin-release-compliance`: Package and release the plugin with review-compliant metadata and supported Obsidian APIs.
- `searchable-plugin-settings`: Make all plugin configuration controls discoverable through Obsidian settings search.

### Modified Capabilities
- None.

## Impact

- `manifest.json`, `versions.json`, `package.json`, and `scripts/verify-release.mjs` release metadata and validation.
- `src/obsidian/import-modal.ts`, `src/obsidian/obsidian-folder-suggest.ts`, and `src/obsidian/provider-settings-tab.ts` Obsidian UI integrations.
- Existing modal and settings-tab tests, plus the release publication process for the `0.1.1` GitHub release.
