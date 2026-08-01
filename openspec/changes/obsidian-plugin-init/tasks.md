## 1. Plugin Scaffold and Tooling

- [x] 1.1 Create the Obsidian community-plugin scaffold (`manifest.json`, `versions.json`, `src/main.ts`) with plugin ID `book-highlights-importer`, minimum Obsidian version `1.11.4`, and desktop/mobile support.
- [x] 1.2 Configure TypeScript, esbuild, Vitest, linting, and package scripts, and install `yandex-book-api-ts` from the checked-in `yandex-book-api-ts-0.0.2.tgz` without patching or copying its implementation.
- [x] 1.3 Add CI-safe commands for type checking, unit tests, production bundling, and verifying that release output contains the required Obsidian plugin files.

## 2. Provider-Neutral Core

- [x] 2.1 Define immutable `ProviderBook`, **Book Annotation**, and **Import Snapshot** models with provider/book identity, normalized status, ordering fields, and stable input indexes, covered by unit tests that require neither Obsidian nor network access.
- [x] 2.2 Define narrow reading-provider, credential-store, settings-repository, and note-repository ports plus credential, authentication, availability, incomplete-data, destination-conflict, and post-commit warning result types.
- [x] 2.3 Implement an immutable compile-time **Provider Registry** and tests proving settings and imports discover each registered **Provider Adapter** without runtime loading.
- [x] 2.4 Implement and test library grouping and title/author search so every returned book appears once in In progress, Finished, then Unread or unknown order.
- [x] 2.5 Implement and test provider-neutral annotation filtering and deterministic ordering by section order, numeric location/progress, creation time, and stable input index.
- [x] 2.6 Implement the import use case with tests for a missing **Provider Credential**, credential re-reading before every provider operation, early/deferred fetch capability, empty snapshots, and no note operation before confirmation.
- [x] 2.7 Implement destination defaults, last-successful-folder precedence, vault-safe path normalization, editable `Author - Title.md` filename sanitization, and persistence only after a committed note write.

## 3. Managed Note Policy

- [x] 3.1 Implement the fixed Markdown renderer with golden tests for chapter paths, heading-depth capping, Highlights fallback, blockquoted highlights, attached/comment-only callouts, locations, and untrusted Markdown text.
- [x] 3.2 Implement canonical marker identity encoding and strict parsing for exactly one version-1 **Managed Section**, rejecting malformed, duplicated, nested, unsupported, or identity-mismatched markers.
- [x] 3.3 Implement namespaced `book-highlights-` frontmatter serialization and merge tests that refresh the complete owned field set while preserving every user-owned key and body region.
- [x] 3.4 Implement the **Managed Book Note** service with tests for one-call create/update, latest-content processing, complete-snapshot replacement, destination conflicts, rendering failures, and zero writes on every pre-commit failure.
- [x] 3.5 Add property-oriented tests for arbitrary user text, YAML values, marker-like imported content, invalid percent encoding, and repeated re-imports without duplicate managed content.

## 4. Runtime Compatibility Gates

- [x] 4.1 Build a minimal compatibility harness and verify the unmodified Yandex package can call `getProfile()`, `getMyLibrary()`, and `getUserQuotes()` in supported Obsidian desktop and mobile runtimes; record sanitized evidence and stop for an upstream replacement package if either runtime fails.
  - Superseded result: version `0.0.0` failed at `getProfile()` in Obsidian desktop `1.12.7` with a pre-response transport `ApiError`. Version `0.0.2` adds public transport injection; re-run the gate through the Obsidian `requestUrl()` adapter on desktop and mobile.
  - Desktop result: version `0.0.2` through `requestUrl()` succeeded on Obsidian `1.12.7` for profile, a 20-book library, and 40 account quotes. Mobile result: the runtime compatibility harness reported success for the same operations, with 20 books and 40 importable quotes; the captured evidence did not include the Obsidian version.
- [x] 4.2 Verify with sanitized live samples that `profile.login` is accepted by `getUserQuotes()`, `quote.book.uuid` identifies the selected book, pagination terminates reliably, and any stable quote source key has consistent semantics; do not fall back to the numeric `profile.id`, which returned `404 NotFound` during the compatibility spike.
- [x] 4.3 Record and fixture the observed `LibraryCard.state` values and `readingProgress` scale, defining only proven mappings and retaining unknown values as `unknown`.
- [x] 4.4 Verify SecretStorage save/read/replace and empty-value Clear behavior on desktop and mobile, documenting a blocking incompatibility rather than falling back to ordinary plugin data.
  - Desktop and mobile results: save/read, replacement, and empty-value Clear all passed through the runtime compatibility harness.

## 5. Yandex Provider Adapter

- [ ] 5.1 Implement Yandex credential testing through `getProfile()` with tests for unauthorized, unavailable, rejected, blank-identity, and unknown failures that never expose a **Provider Credential**.
- [ ] 5.2 Implement complete library pagination and normalization with tests for offset advancement, short final pages, repeated full pages, no-progress pages, safety-limit exhaustion, missing text-book IDs, and proven status/progress mappings.
- [ ] 5.3 Implement complete quote pagination with tests for page signatures, stable-key deduplication, conflicting duplicates, ambiguous cross-page overlap, malformed pagination, safety limits, and hard failure instead of partial results.
- [ ] 5.4 Map only records belonging to the selected book, fail when an otherwise importable quote lacks owning-book identity, sanitize provider text, retain highlight/comment pairs, and exclude records where both values are blank.
- [x] 5.5 Add an opt-in Yandex smoke test using `YANDEX_BOOKS_OAUTH_TOKEN` that persists no live response and emits neither the token nor unsafe provider details.

## 6. Obsidian Adapters and Settings

- [ ] 6.1 Implement version-1 non-secret plugin settings for default and last folders, including migration-safe loading defaults and tests proving raw credentials are never serialized.
- [ ] 6.2 Implement the credential-store adapter with provider-specific lowercase secret IDs and SecretStorage get/set/blank-clear behavior.
- [ ] 6.3 Implement the vault/workspace note adapter with destination inspection, one `Vault.create()` or `Vault.process()` commit operation, vault path safety, and result-note opening.
- [ ] 6.4 Implement provider settings discovered from the **Provider Registry**, including configured status, temporary masked token entry, save/replace/clear actions, and connection-test success/authentication/unavailable states.
- [ ] 6.5 Add Obsidian-adapter tests with host fakes for settings failures, vault conflicts, create/process failures, note-opening failures, and secret redaction.

## 7. Guided Import Wizard

- [ ] 7.1 Register `Import Book Highlights` and implement one native-control modal with Provider, Book, Destination, Review, Loading, Importing, and Error states that works on desktop and mobile.
- [ ] 7.2 Implement provider selection with configured-status enforcement, no library call for missing credentials, authentication guidance, retry, cancel, and safe Back navigation.
- [ ] 7.3 Implement searchable grouped book selection, empty-library handling, exactly-one selection, and invalidation of downstream state when provider or book identity changes.
- [ ] 7.4 Implement generation- and identity-guarded asynchronous requests so provider changes, book changes, Back, retry, and cancel discard stale library or annotation responses.
- [ ] 7.5 Implement early annotation fetching and deferred-fetch confirmation flows, showing the annotation count when available and blocking destination work for an empty early **Import Snapshot**.
- [ ] 7.6 Implement destination folder/filename controls and the Review summary, requiring explicit confirmation before any note write.
- [ ] 7.7 Implement completion and failure behavior for retryable provider errors, destination correction, cancellation, success count, result-note opening, and non-rollback warnings when folder persistence or note opening fails after commit.

## 8. Composition and Verification

- [ ] 8.1 Compose the application core, Yandex **Provider Adapter**, Obsidian adapters, settings tab, command, and immutable **Provider Registry** at plugin startup with load/unload tests.
- [ ] 8.2 Add integration tests covering initial import, safe re-import, stale annotation removal, user content/frontmatter preservation, identity conflicts, malformed markers, cancellation, network failure, and no-importable-annotation behavior.
- [ ] 8.3 Run type checking, linting, all Vitest suites, the production build, and release-output verification; fix failures without weakening the specified safety checks.
- [ ] 8.4 Run `openspec validate obsidian-plugin-init --type change --strict` and resolve every behavior-spec or artifact validation error before archive.
- [ ] 8.5 Complete and record the desktop/mobile manual release matrix for SecretStorage save/test/replace/clear, full library pagination/grouping, early fetch, destination defaults, initial import, safe re-import, conflict rejection, cancellation, network failure, and opening the result.
