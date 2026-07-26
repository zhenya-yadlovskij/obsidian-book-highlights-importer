## Why

Obsidian users who read on LitRes need a simple way to bring their own highlights and notes into their vault without manually copying passages book by book. Starting with LitRes gives the plugin a documented adapter target before adding less certain platforms such as Yandex Books later.

## What Changes

- Add an Obsidian plugin capability for importing highlights through a command-driven flow.
- Add a LitRes adapter that stores its required auth configuration in Obsidian plugin settings.
- Add an `Import Highlights` command that fetches the user's owned LitRes books and lets the user select exactly one book.
- After a book is selected, fetch only that book's user-created highlights and notes from LitRes.
- Ask the user for the target note folder/path and note name before importing.
- Create or update the selected note with imported highlights and notes while preserving user-authored manual edits.
- Ignore LitRes records that only represent reading position or empty bookmarks with no selected text and no user note.
- Leave Yandex Books, LitRes audiobook bookmarks, background sync, and bulk multi-book import out of this initial change.

## Capabilities

### New Capabilities

- `litres-highlights-import`: Import a user's LitRes highlights and notes into an Obsidian note through a settings-backed, command-driven workflow.

### Modified Capabilities

- None.

## Impact

- Adds an Obsidian community plugin codebase with TypeScript plugin entry points, settings UI, command registration, modal-based user choices, and vault file updates.
- Adds LitRes API integration for authenticated "my books" and selected-book notes/highlights retrieval.
- Adds Markdown rendering logic for stable, repeatable imports that can update generated content without deleting manual note edits.
- Introduces tests or focused verification for LitRes response normalization, import filtering, Markdown rendering, and note update behavior.
