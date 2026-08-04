## Why

The runtime compatibility harness was a temporary manual validation tool for Yandex Books integration. Its compatibility checks have been completed, so retaining an end-user command exposes an unnecessary unsupported workflow and leaves dead production code in the plugin.

## What Changes

- **BREAKING** Remove the `Open runtime compatibility harness` command from the Obsidian plugin.
- Remove the now-unreachable runtime compatibility modal and Yandex runtime harness implementation.
- Remove tests and test fixtures that exist solely to support the retired harness.
- Preserve the import command, provider settings, credential handling, and Yandex Books import behavior.

## Capabilities

### New Capabilities

- `runtime-compatibility-command-removal`: Defines the absence of the retired compatibility command and preservation of the supported import workflow.

### Modified Capabilities

- None.

## Impact

- Affected production code: `src/main.ts`, `src/compatibility/yandex-runtime.ts`, and `src/obsidian/runtime-compatibility-modal.ts`.
- Affected tests and fixture: `tests/main.test.ts`, compatibility/modal test suites, and `tests/fixtures/yandex/runtime-observations.json`.
- No external dependencies, persistent data, or supported import APIs change.
