## 1. Project Setup

- [ ] 1.1 Create the Obsidian plugin scaffold with manifest, TypeScript config, build config, package scripts, and plugin entry point.
- [ ] 1.2 Add test tooling for focused unit tests around parsing, filtering, rendering, and note update behavior.
- [ ] 1.3 Define shared domain types for reading-platform adapters, books, highlights, import destinations, and plugin settings.

## 2. LitRes Settings And Auth

- [ ] 2.1 Verify the exact LitRes authentication fields and request shape needed for owned-books and notes/highlights API calls.
- [ ] 2.2 Implement persisted plugin settings with LitRes auth configuration and optional default import folder.
- [ ] 2.3 Implement the Obsidian settings tab for editing and saving LitRes configuration.
- [ ] 2.4 Add configuration validation and user-facing notices for missing or invalid LitRes settings.

## 3. LitRes Adapter

- [ ] 3.1 Implement a LitRes API client using Obsidian-compatible network requests.
- [ ] 3.2 Implement owned electronic-book listing via the LitRes owned-books API, including pagination if required.
- [ ] 3.3 Implement selected-book notes/highlights retrieval via the LitRes notes API.
- [ ] 3.4 Normalize LitRes book responses into the shared book model.
- [ ] 3.5 Normalize LitRes note/highlight records into the shared highlight model.
- [ ] 3.6 Filter out records with no selected text and no user note.
- [ ] 3.7 Convert LitRes HTML note and selection fields into safe Markdown or plain text.

## 4. Import Command Flow

- [ ] 4.1 Register the `Import Highlights` Obsidian command.
- [ ] 4.2 Implement the command preflight that validates settings before making LitRes requests.
- [ ] 4.3 Implement a searchable owned-book picker that allows selecting exactly one book.
- [ ] 4.4 Implement destination prompts for folder/path and note name with a sensible default note name.
- [ ] 4.5 Add user-facing notices for empty libraries, selected books with no importable records, network failures, and canceled steps.

## 5. Markdown Rendering And Note Updates

- [ ] 5.1 Implement Markdown rendering for book metadata, imported highlights, user notes, source IDs, and locations.
- [ ] 5.2 Implement managed block markers for LitRes imports keyed by source and book ID.
- [ ] 5.3 Implement note creation when the destination note does not exist.
- [ ] 5.4 Implement managed-block replacement for re-import into an existing note.
- [ ] 5.5 Implement append behavior when an existing note has no managed block for the selected book.
- [ ] 5.6 Add conservative error handling for malformed or ambiguous managed block markers.

## 6. Verification

- [ ] 6.1 Add unit tests for LitRes owned-book response normalization.
- [ ] 6.2 Add unit tests for LitRes notes/highlights normalization and empty-record filtering.
- [ ] 6.3 Add unit tests for HTML-to-Markdown/plain-text conversion.
- [ ] 6.4 Add unit tests for Markdown rendering and managed-block note update behavior.
- [ ] 6.5 Run plugin build and test commands successfully.
- [ ] 6.6 Perform a manual Obsidian smoke test covering settings save, book selection, destination prompts, first import, and re-import preserving manual edits.
