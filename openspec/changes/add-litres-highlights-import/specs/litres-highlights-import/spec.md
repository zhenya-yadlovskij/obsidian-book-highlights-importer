## ADDED Requirements

### Requirement: LitRes settings are stored
The plugin SHALL provide settings for the LitRes adapter and persist the configured LitRes authentication data in Obsidian plugin settings.

#### Scenario: Save LitRes settings
- **WHEN** the user enters valid LitRes adapter configuration in the plugin settings
- **THEN** the plugin stores the configuration for future import commands

#### Scenario: Reuse stored LitRes settings
- **WHEN** the user runs the import command after configuring LitRes settings
- **THEN** the plugin uses the stored settings without asking the user to re-enter them

### Requirement: Import command validates configuration
The plugin SHALL expose an Obsidian command named `Import Highlights` and SHALL validate that required LitRes settings are present before contacting LitRes.

#### Scenario: Missing LitRes settings
- **WHEN** the user runs `Import Highlights` without required LitRes settings
- **THEN** the plugin shows a clear error and does not call the LitRes API

#### Scenario: Invalid LitRes settings
- **WHEN** LitRes rejects the configured authentication during import
- **THEN** the plugin shows a clear authentication error and does not create or update a note

### Requirement: User selects one owned LitRes book
The plugin SHALL fetch the user's owned LitRes electronic books and present them in a searchable selection UI that allows selecting exactly one book.

#### Scenario: Show owned books
- **WHEN** the user runs `Import Highlights` with valid LitRes settings
- **THEN** the plugin fetches and displays the user's owned LitRes books without pre-filtering by highlight presence

#### Scenario: Select a single book
- **WHEN** the owned-books picker is displayed
- **THEN** the user can select exactly one book to import from

#### Scenario: No owned books
- **WHEN** LitRes returns no owned books for the configured user
- **THEN** the plugin shows a clear message and stops the import flow

### Requirement: Selected book highlights are fetched
The plugin SHALL fetch LitRes notes and highlights only for the book selected by the user.

#### Scenario: Fetch selected book records
- **WHEN** the user selects a book from the owned-books picker
- **THEN** the plugin requests notes and highlights for that selected book

#### Scenario: Do not scan unselected books
- **WHEN** the import command displays the owned-books picker
- **THEN** the plugin does not request notes or highlights for books the user has not selected

### Requirement: Only user-created highlights and notes are imported
The plugin SHALL import LitRes records that contain selected text or a user note and SHALL ignore records that only represent reading position or empty bookmarks.

#### Scenario: Import selected text
- **WHEN** a LitRes record contains non-empty selected text
- **THEN** the plugin includes that selected text in the imported note

#### Scenario: Import user note
- **WHEN** a LitRes record contains a non-empty user note
- **THEN** the plugin includes that user note in the imported note

#### Scenario: Ignore empty location record
- **WHEN** a LitRes record has no selected text and no user note
- **THEN** the plugin excludes that record from the imported note

#### Scenario: No importable records
- **WHEN** the selected book has no records with selected text or user notes
- **THEN** the plugin shows a clear message and does not create or update a note

### Requirement: User chooses destination note
The plugin SHALL ask the user for the destination folder or path and note name before writing imported content.

#### Scenario: Choose destination
- **WHEN** importable records are found for the selected book
- **THEN** the plugin asks the user for the destination folder or path and note name

#### Scenario: Confirm note name
- **WHEN** the destination prompt is displayed
- **THEN** the plugin provides a sensible default note name based on the selected book and allows the user to change it

### Requirement: Import writes structured Markdown
The plugin SHALL render imported LitRes highlights and notes as structured Markdown in the selected Obsidian note.

#### Scenario: Create new note
- **WHEN** the destination note does not exist
- **THEN** the plugin creates the note and writes book metadata plus imported highlights and notes

#### Scenario: Include source metadata
- **WHEN** the plugin writes imported content
- **THEN** the note content identifies LitRes as the source and includes the selected book identity

#### Scenario: Preserve highlight text and note text
- **WHEN** a LitRes record has both selected text and a user note
- **THEN** the rendered Markdown includes both pieces of content for the same imported item

### Requirement: Re-import preserves manual edits
The plugin SHALL update generated LitRes import content without deleting user-authored content outside the plugin-managed section.

#### Scenario: Update existing managed block
- **WHEN** the destination note already contains a plugin-managed block for the selected LitRes book
- **THEN** the plugin replaces only that managed block with freshly rendered import content

#### Scenario: Preserve text outside managed block
- **WHEN** the destination note contains user-authored content before or after the plugin-managed block
- **THEN** that user-authored content remains unchanged after re-import

#### Scenario: Append managed block to existing note
- **WHEN** the destination note exists but has no plugin-managed block for the selected LitRes book
- **THEN** the plugin appends a new managed block without deleting existing note content
