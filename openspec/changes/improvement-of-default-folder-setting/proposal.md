## Why

The current default-folder setting requires users to type a path and explicitly press a Save button, which interrupts a simple configuration task and provides no help discovering valid vault folders. Users should be able to enter a folder naturally, see matching vault paths while typing, and use new folder paths without preparing the vault manually.

## What Changes

- Remove the explicit Save default folder button from the settings UI.
- Persist default-folder input automatically with debounced saves while the user types.
- Add autocomplete suggestions for matching vault-relative folders, including nested folders.
- Keep allowing free-form vault-relative paths, including paths that do not yet exist.
- Create the complete missing destination-folder hierarchy immediately before importing a note for any valid import destination.
- Report folder-creation failures through the existing retryable import error flow without writing a note to an unavailable destination.

## Capabilities

### New Capabilities

- `default-folder-setting`: Configure and persist a vault-relative default import folder with debounced auto-save and matching vault-folder autocomplete.

### Modified Capabilities

- `streamlined-import-wizard`: Allow valid destinations whose folders do not yet exist by creating the destination hierarchy before the note write, while preserving destination validation and retry behavior.

## Impact

- The Obsidian provider settings tab and its default-folder control.
- Vault folder discovery and autocomplete integration.
- Import settings persistence and asynchronous save status handling.
- The note repository and import execution path, including recursive folder creation before note creation or update.
- Import error mapping, user-facing retry behavior, and related unit/integration tests.
