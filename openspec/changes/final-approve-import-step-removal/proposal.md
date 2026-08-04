## Why

The import wizard makes users review information they have already selected before they can start an import. Removing this final approval step shortens the common import path while preserving destination validation and safe failure handling.

## What Changes

- Remove the separate review step from the import wizard.
- Start the import directly from the destination step after the destination is validated.
- Replace the destination step's `Review` action with `Import` and remove review-specific progress text and UI.
- Remove review-only wizard state and confirmation behavior while retaining the existing validation, error, cancellation, and completion paths.

## Capabilities

### New Capabilities
- `streamlined-import-wizard`: Covers starting an import directly from a validated destination without a final review step.

### Modified Capabilities

None.

## Impact

- Affects the import wizard controller, Obsidian import modal, and their unit tests.
- Does not change provider retrieval, destination validation, note-writing behavior, or persisted settings.
