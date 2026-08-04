## Context

`BookHighlightsImporterPlugin.onload()` currently creates a Yandex client for both the supported import composition and a manual runtime compatibility harness. It registers that harness through the `Open runtime compatibility harness` command, which opens a modal for entering a temporary credential and running profile, library, and CSV export checks. The harness was used to validate Obsidian runtime compatibility and is no longer a supported user workflow.

All current ADRs were reviewed. ADR-0005 and ADR-0006 preserve the composition-root boundary used by this change. ADR-0003 and ADR-0007 establish upstream Yandex client ownership and selected-book CSV imports; removing this one-time manual validation path does not change either decision or the supported import flow. No C4 diagram is included because this is a local removal within the existing Obsidian composition root and introduces no changed runtime boundary.

## Goals / Non-Goals

**Goals:**
- Remove the retired command and all production code that only supports it.
- Remove dedicated tests and fixture data that become unreachable with the harness.
- Prove the supported import command remains registered and continues to use the existing composition.

**Non-Goals:**
- Change Yandex Books API behavior, provider configuration, or credential storage.
- Replace the harness with another manual diagnostic interface.
- Alter the project-level test, release, or future compatibility-validation policy.

## Decisions

- Remove the command registration, compatibility modal, and harness module together. Their only production caller is the command registration, so retaining any part would create dead code. The alternative of hiding only the command would retain unsupported credential and network behavior without a consumer.
- Remove harness-specific unit tests and the runtime-observations fixture. These validate a retired manual workflow rather than the supported import behavior. Retain and update lifecycle tests to assert that only the import command is registered and tracked during unload.
- Keep the existing import composition and its Yandex client factory unchanged. It remains the supported path for provider configuration and importing highlights; this removal must not alter its dependencies or behavior.

## Risks / Trade-offs

- [A future runtime regression lacks an in-plugin manual diagnostic] -> Reintroduce a purpose-built developer validation tool only when a new compatibility investigation requires it; supported import tests and release validation remain available.
- [Removing shared startup wiring could affect imports] -> Update lifecycle tests to invoke the import command after startup and verify it retains the existing dependencies.
- [A harness artifact could have an overlooked consumer] -> Search production and test references before deletion and require typecheck, tests, lint, build, and release verification.

## Migration Plan

1. Remove the command registration and its dedicated runtime harness dependencies from the plugin entry point.
2. Delete the retired harness, modal, focused tests, and fixture that have no remaining consumers.
3. Update lifecycle tests for the single supported command and modal-unload behavior.
4. Run the complete project verification suite.

No data migration or rollback action is required. A rollback restores the removed files and command registration as one unit if a supported workflow is unexpectedly affected.

## Open Questions

None.
