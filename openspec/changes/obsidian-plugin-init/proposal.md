## Why

Readers using multiple **Reading Providers** currently have to copy highlights and comments into Obsidian manually, losing time and the context or ordering of the source book. The project needs a usable first provider integration and a provider-neutral import experience that can later support LitRes and other platforms without redesigning the workflow.

## What Changes

- Initialize an Obsidian community plugin that supports desktop and mobile on Obsidian 1.11.4 or newer.
- Add provider-specific settings where users can save, test, replace, and clear a **Provider Credential** through Obsidian SecretStorage, starting with a pasted Yandex Books OAuth token.
- Add an `Import Book Highlights` command that opens one four-step modal for provider selection, single-book selection, destination selection, and final review.
- Add Yandex Books as the first built-in **Provider Adapter**, using the supplied `yandex-book-api-ts` package for profile, library, and quote access.
- Show all available Yandex library books in searchable groups ordered as in progress, finished, then unread or unknown.
- Fetch and validate the selected book's **Book Annotation** records before final confirmation when the provider supports early fetching; otherwise fetch them after confirmation.
- Import highlighted text, attached comments, or both, while ignoring records that contain neither.
- Create one **Managed Book Note** per selected book using an editable `Author - Title.md` default filename and a configurable, remembered destination folder.
- Render fixed, chapter-first Markdown when provider structure is available; otherwise preserve book order and display the best available progress or location without inventing chapter names.
- Store namespaced source metadata in frontmatter and update only those namespaced fields and the matching **Managed Section** on re-import, preserving user-authored content and unrelated frontmatter.
- Validate the complete import before one atomic vault update, reject destination files associated with another provider or book, and open the resulting note after success.
- Add automated provider-neutral and Yandex adapter coverage, an environment-gated Yandex smoke test, and manual desktop and mobile verification.
- Keep LitRes and other providers, multi-book import, background synchronization, built-in OAuth login, exact chapter reconstruction, and user-defined Markdown templates outside this change.

## Capabilities

### New Capabilities

- `reading-provider-configuration`: Configure and validate credentials for built-in reading providers without storing raw secrets in ordinary plugin settings.
- `book-highlights-import`: Run a provider-neutral wizard that selects one provider and book, obtains importable annotations, confirms a destination, and reports a safe import result.
- `managed-book-notes`: Create and safely re-import structured book notes while preserving user-owned Markdown and frontmatter.

### Modified Capabilities

None.

## Impact

- Adds the TypeScript Obsidian plugin scaffold, command and modal UI, provider registry, normalized book and annotation contracts, Markdown rendering, settings, and vault update behavior.
- Integrates Obsidian commands, modals, SecretStorage, plugin data, vault file operations, and workspace navigation with a minimum supported Obsidian version of 1.11.4.
- Adds the supplied `yandex-book-api-ts-0.0.2.tgz` as a separately maintained dependency; desktop or mobile incompatibilities must be reported for an upstream library update rather than patched inside the plugin.
- Contacts Yandex Books only during explicit configuration tests and user-initiated imports; OAuth tokens and live account responses must not be committed or logged.
- Introduces stable generated-note markers and namespaced frontmatter fields that future provider adapters must honor.
