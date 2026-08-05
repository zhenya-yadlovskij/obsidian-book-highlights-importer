## 1. Serialize import-settings updates

- [ ] 1.1 Add failing `settings-repository` tests that prove serialized updates preserve both the latest default folder and the last successful folder, retain version-1 credential-safe serialization, and propagate host load/save failures.
- [ ] 1.2 Replace caller-owned `SettingsRepositoryPort.save` with a serialized update operation in `src/core/ports.ts` and `src/obsidian/settings-repository.ts`, then make `src/core/import.ts` update only `lastFolder` after a committed note write.
- [ ] 1.3 Update import-use-case fixtures and tests to use the new settings update contract, proving post-commit persistence still occurs only after a successful **Managed Book Note** write.

## 2. Add default-folder autocomplete and automatic persistence

- [ ] 2.1 Add focused tests for an Obsidian-local folder suggestion helper that lists matching nested **Vault-relative folder** paths, excludes nonmatching paths and the vault root, applies a selected suggestion, and leaves unmatched typed values unchanged.
- [ ] 2.2 Implement the folder suggestion helper under `src/obsidian/` using the current Obsidian Vault folder collection and native text-input integration, with cleanup when its settings-tab input is discarded.
- [ ] 2.3 Replace the default-folder Save button in `src/obsidian/provider-settings-tab.ts` with a 300 ms debounced settings update that preserves the most recent input, prevents stale async status updates after rerender or hide, and shows fixed inline save-failure feedback without disabling correction.
- [ ] 2.4 Update `provider-settings-tab` tests with fake-timer and Vault doubles to cover automatic save after a pause, rapid input changes, save failures, suggestion selection, and the absence of the Save button.

## 3. Create missing import destination folders safely

- [ ] 3.1 Extend `NoteRepositoryPort` and the managed-note result types with `ensureFolder(folder)` and retryable `destination-unavailable`, then add managed-note service tests proving folders are ensured only after snapshot rendering and target inspection but before a new note is created.
- [ ] 3.2 Implement recursive, normalized folder creation in `src/obsidian/note-repository.ts`, handling existing folders, concurrent creation, and files that occupy a required path segment; add adapter tests for each outcome.
- [ ] 3.3 Update `src/notes/service.ts` to ensure a missing **Vault-relative folder** hierarchy before creating a new **Managed Book Note**, map creation failures to `destination-unavailable`, and retain the existing atomic process path for managed-note updates.
- [ ] 3.4 Update `src/core/import-wizard.ts` and controller tests so `destination-unavailable` displays destination-specific safe guidance, preserves the destination state, and offers Retry without writing a note.

## 4. Verify the change

- [ ] 4.1 Run the focused settings repository, settings-tab, note repository, managed-note service, import, and import-wizard test files; resolve failures without weakening existing safe-path, ownership, or post-commit guarantees.
- [ ] 4.2 Run `npm test` and `npm run check` after implementation.
- [ ] 4.3 Run `openspec validate improvement-of-default-folder-setting --type change --strict` before archive.
