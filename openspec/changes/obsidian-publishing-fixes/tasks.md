## 1. Patch Release Metadata

- [ ] 1.1 Update `manifest.json`, `package.json`, and `versions.json` for version `0.1.1`, minimum app version `1.13.0`, and a description without the word "Obsidian".
- [ ] 1.2 Update `scripts/verify-release.mjs` to validate the patched version, minimum app version, and compliant description in built release artifacts.
- [ ] 1.3 Add or update release-metadata verification coverage and confirm that the built artifacts satisfy it.

## 2. Review-Compliant UI APIs

- [ ] 2.1 Replace the review-listed generic DOM creation in the import modal and folder suggestion with `createDiv` and update their test doubles and assertions.
- [ ] 2.2 Create the temporary Yandex authorization anchor through an Obsidian-managed element helper while preserving its external-browser behavior.
- [ ] 2.3 Use `window.setTimeout` and `window.clearTimeout` for default-folder debounce scheduling and cleanup.
- [ ] 2.4 Run the focused import-modal and provider-settings-tab tests to preserve existing visible behavior.

## 3. Searchable Settings

- [ ] 3.1 Add failing settings-tab tests for searchable definitions covering the default folder, Yandex OAuth guidance, and registered provider controls.
- [ ] 3.2 Implement `getSettingDefinitions()` using renderers for all existing user-facing settings and retain the current dynamic controls.
- [ ] 3.3 Preserve credential redaction, connection-test freshness, folder suggestions, delayed saves, and authorization behavior in the declarative settings implementation.
- [ ] 3.4 Run the provider-settings-tab test suite and confirm all existing and new cases pass.

## 4. Release Validation And Submission

- [ ] 4.1 Run `openspec validate obsidian-publishing-fixes --type change --strict` and resolve any validation errors.
- [ ] 4.2 Run `npm run check` and confirm type checking, linting, tests, build, and release verification pass.
- [ ] 4.3 Create a GitHub release named with `0.1.1` using the built release assets.
- [ ] 4.4 Submit the `0.1.1` release to Obsidian plugin review and confirm the fresh review reports no errors or warnings.
