## Context

The current `0.1.0` release was rejected by the Obsidian plugin review because its manifest description contains "Obsidian" and because its release metadata and UI APIs trigger warnings. The plugin currently supports Obsidian `1.11.4`, renders settings imperatively, and stores **Provider Credential** values through Obsidian SecretStorage.

The affected code is contained in the Obsidian adapter layer and release metadata. The application core, **Provider Adapter** boundaries, and provider registration remain unchanged. ADR-0002 is in force and establishes SecretStorage with a `1.11.4` minimum version; raising the minimum version requires a new ADR that supersedes that platform-version part while retaining SecretStorage.

```text
[Plugin user]
    |
    v
[Obsidian desktop/mobile]
    |
    v
[Book Highlights Importer plugin]
    |-- Declarative settings definitions
    |     |-- Provider credentials -> Obsidian SecretStorage
    |     `-- Default folder -> plugin data
    |
    |-- Import UI -> application core -> provider adapters
    |
    `-- Build/release artifacts
          |
          v
     [GitHub release 0.1.1]
          |
          v
     [Obsidian plugin review]
```

## Goals / Non-Goals

**Goals:**
- Produce a `0.1.1` release with compliant manifest metadata and a version-bearing GitHub release name.
- Make the default folder, Yandex OAuth guidance, and registered provider controls searchable in Obsidian `1.13.0` and later.
- Preserve current credential secrecy, provider connection-test freshness, folder suggestions, delayed saves, and browser authorization behavior.
- Replace every review-listed DOM and timer API use with Obsidian-compatible alternatives.

**Non-Goals:**
- Support Obsidian versions earlier than `1.13.0`.
- Change the application core, provider adapter contracts, SecretStorage usage, or import behavior.
- Add release automation, artifact attestations, or release-asset cleanup.

## Decisions

### Require Obsidian `1.13.0` and use declarative setting definitions

The plugin will raise its minimum app version to `1.13.0` and implement `PluginSettingTab.getSettingDefinitions()`. Each user-facing setting will be represented by a searchable definition with a renderer that hosts the existing dynamic control behavior.

This is preferred over maintaining imperative and declarative settings paths because one platform floor avoids divergent settings behavior and test coverage. It is preferred over retaining the `1.11.4` floor because the review warning requires settings search support and the declarative API is available from `1.13.0`.

### Preserve the existing adapter and storage boundaries

Definition renderers will continue to use the existing settings repository, **Provider Registry**, and SecretStorage-backed **Provider Credential** interfaces. The change does not move settings logic into the application core or add a new persistence format.

This is preferred over replacing the dynamic controls with static control definitions because provider configuration requires secret handling, connection tests, and state-dependent statuses that the current adapter already owns.

### Use host-aware DOM and timer APIs

The book-result container and folder suggestion will use the specific `createDiv` helper. The temporary authorization link will be created through an Obsidian-managed element helper, retaining its current target, relation, click, and removal behavior. The default-folder debounce will call `window.setTimeout` and `window.clearTimeout`.

This is preferred over retaining direct document construction and unqualified timers because the review requires host-aware APIs and popup windows need their own timer functions.

### Release the patch manually

The project will build and validate `main.js`, `manifest.json`, and `versions.json` locally, then the maintainer will create a GitHub release whose name includes `0.1.1`.

This is preferred over adding a release workflow because automation and provenance attestations are outside the selected review-warning scope.

## Risks / Trade-offs

- [Users on Obsidian `1.11.4` or `1.12.x` cannot install `0.1.1`] -> The release metadata makes the new platform requirement explicit; `0.1.0` remains available for those users.
- [Renderer migration can regress dynamic settings behavior] -> Preserve the existing settings repository and credential interfaces, and extend existing unit tests for redaction, stale connection results, folder suggestions, and delayed saves.
- [The review may continue flagging a compliant source location] -> Submit `0.1.1` after replacing all listed locations and use the new review result as the authoritative outcome before further changes.
- [Manual publication can use an incorrect release name] -> Include the version-bearing release title in the release checklist and verify it before review submission.

## Migration Plan

1. Update manifest, package, and version metadata to `0.1.1` and set the minimum app version to `1.13.0`.
2. Migrate the settings tab and review-listed UI APIs with focused unit tests.
3. Run `npm run check` to build and validate the release artifacts.
4. Create the GitHub release with the built assets and a name containing `0.1.1`.
5. Submit the release for Obsidian review and confirm it has no errors or warnings.

No persisted plugin-data migration is required. If local verification or review fails, do not publish the patch; correct the reported issue in a subsequent build. The existing `0.1.0` release remains the rollback version for users unable to run `1.13.0`.

## Open Questions

- The ADR artifact must supersede ADR-0002's `1.11.4` minimum-version decision while retaining its SecretStorage decision. No other in-force ADR requires revision.
