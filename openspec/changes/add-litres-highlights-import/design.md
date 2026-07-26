## Context

This repository is starting from an empty Obsidian plugin project. The first usable capability is a LitRes-only highlight importer that runs from an Obsidian command. The user configures LitRes authentication once in plugin settings, runs `Import Highlights`, selects one owned LitRes book, chooses the destination folder and note name, and imports that book's user-created highlights and notes.

LitRes exposes authenticated API methods for the user's owned books and for notes/highlights on a selected book. The MVP should avoid expensive pre-scanning for books with highlights; it should list owned electronic books first and query notes only after the user selects a book.

## Goals / Non-Goals

**Goals:**

- Provide a first Obsidian community plugin implementation focused on LitRes.
- Store LitRes auth configuration in Obsidian plugin settings so the user does not re-enter credentials for every import.
- Fetch the user's owned LitRes books and present them in a searchable one-book selection modal.
- Fetch highlights and notes only for the selected book.
- Import entries with selected text or user note text into a Markdown note.
- Preserve manual edits when re-importing into an existing note.
- Keep the importer structured so Yandex Books or other platforms can be added later without rewriting the note rendering and update path.

**Non-Goals:**

- Yandex Books support.
- Bulk import of multiple books in one command run.
- Background or scheduled sync.
- Importing public quotes, social comments, ratings, reviews, or other readers' content.
- Importing empty reading-position markers or bookmarks with no selected text and no user note.
- LitRes audiobook or podcast bookmarks.
- Full chapter reconstruction from downloaded book files.

## Decisions

### Use An Adapter Boundary

Create a small adapter contract for reading-platform sources, with LitRes as the only implementation in this change. The command flow depends on generic operations such as `listBooks()` and `listBookHighlights(bookId)`, while LitRes-specific request signing, response parsing, and auth details stay inside the LitRes adapter.

Alternative considered: build the command directly against LitRes. That is faster for the first endpoint but makes Yandex Books harder to add later and mixes UI flow with API response details.

### Store LitRes Auth In Plugin Settings

Store the LitRes auth configuration with Obsidian plugin `loadData()` / `saveData()`. The settings tab should expose the required fields, validate presence before import, and report invalid credentials clearly when LitRes rejects a request.

Alternative considered: ask for credentials every import. That keeps less data at rest but makes the normal workflow tedious and contradicts the desired CJM.

Security note: Obsidian plugin settings are local convenience storage, not a hardened secret manager. Prefer storing a token/session/API value over storing a username and password if LitRes supports the chosen auth flow cleanly.

### Query Notes Only After Book Selection

The command should call the LitRes owned-books endpoint first, show all supported owned electronic books, and only call the notes/highlights endpoint for the selected book.

Alternative considered: scan every owned book up front and show only books with highlights. That would match a narrower picker but can be slow for large libraries and adds progress/rate-limit complexity to the MVP.

### Normalize Before Rendering

Map LitRes records into internal `Book` and `Highlight` models before rendering Markdown.

```
LitRes API response
        |
        v
LitRes adapter parser
        |
        v
Normalized Book / Highlight
        |
        v
Markdown renderer + note updater
```

Normalized highlights should preserve source IDs, selected text, user note, percent/location, update time, and any available title/chapter-ish metadata. HTML fields from LitRes should be converted to safe Markdown/plain text before writing to the note.

### Preserve Manual Edits With A Managed Block

The plugin should write imported content inside a clearly marked generated block in the target note. On re-import, it replaces only that managed block and leaves content before and after the block untouched.

```md
User-written intro stays here.

<!-- book-highlights-importer:start source=litres bookId=123 -->
Generated LitRes highlights go here.
<!-- book-highlights-importer:end -->

User-written reflections stay here.
```

If the note exists but has no managed block for the selected LitRes book, append a new managed block. If the note does not exist, create it with frontmatter, a title, and the managed block.

Alternative considered: overwrite the whole note. That is simpler but would destroy user-authored Obsidian notes and makes re-import unsafe.

## Risks / Trade-offs

- LitRes auth requirements may require app credentials or a session value that is awkward for users to obtain -> keep auth handling isolated in the adapter and validate with a small integration spike before broad UI work.
- Plugin settings store auth data locally without OS-level secret protection -> prefer token/session values and document the local-storage behavior in settings copy.
- LitRes may return HTML in `note` and `selection_text` -> sanitize and convert supported inline tags to Markdown or safe text.
- Owned libraries may be large -> paginate the owned-book query and keep the picker searchable; avoid notes pre-scanning in the MVP.
- Existing notes may contain malformed or manually edited managed markers -> fail conservatively with a clear notice instead of rewriting ambiguous content.
- LitRes records may not include reliable chapter names -> render by percent/location first and only show chapter/part metadata when available from the API response.

## Migration Plan

There is no existing plugin state to migrate. The initial release adds settings storage and writes managed blocks into user-selected notes. Rollback is manual: disabling the plugin stops future imports and existing Markdown notes remain normal vault files.

## Open Questions

- Which exact LitRes auth fields will be required for a user-friendly configuration flow after testing against the current API?
- Should the note-name default be fixed as `Author - Title` or configurable via a template setting in the first release?
- Should the first release support Obsidian mobile, or target desktop only until LitRes auth and request behavior are stable?
