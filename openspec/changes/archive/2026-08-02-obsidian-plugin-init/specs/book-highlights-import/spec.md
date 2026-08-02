## ADDED Requirements

### Requirement: Import runs as a guided command
Feature: Book highlights import

The plugin SHALL provide an `Import Book Highlights` command that guides the user through provider, book, destination, and review steps in one modal.

#### Scenario: Start the import wizard
- **GIVEN** the plugin is enabled
- **WHEN** the user runs `Import Book Highlights`
- **THEN** one import wizard opens at the provider step
- **AND** shows the four steps Provider, Book, Destination, and Review

#### Scenario: Return to an earlier step
- **GIVEN** the user has made selections in later wizard steps
- **WHEN** the user goes back to an earlier step
- **THEN** compatible selections already made in this import remain available

#### Scenario: Cancel an import
- **GIVEN** an import wizard is open
- **WHEN** the user cancels from any step
- **THEN** the wizard closes without creating or changing a note

### Requirement: User selects one configured provider
The wizard SHALL present registered **Reading Providers** and allow exactly one configured provider for an import.

#### Scenario: Select Yandex Books
- **GIVEN** Yandex Books has a usable configured credential
- **WHEN** the user selects Yandex Books
- **THEN** the wizard proceeds to load the Yandex Books library

#### Scenario: Selected provider is not configured
- **GIVEN** a reading provider has no usable credential
- **WHEN** the user selects that provider
- **THEN** the wizard does not proceed to book selection
- **AND** explains how to configure the provider

### Requirement: User selects one library book
The wizard SHALL show all books returned by the selected provider in a searchable list and SHALL allow exactly one book to be selected.

#### Scenario: Group a Yandex Books library
- **GIVEN** Yandex Books returns in-progress, finished, unread, and unknown-status books
- **WHEN** the book step is displayed
- **THEN** the groups appear in the order In progress, Finished, then Unread or unknown
- **AND** every returned book appears in one group

#### Scenario: Search the library
- **GIVEN** the book step contains multiple books
- **WHEN** the user searches by title or author
- **THEN** only books matching the search remain visible
- **AND** their group order remains unchanged

#### Scenario: Select one book
- **GIVEN** the provider library is displayed
- **WHEN** the user chooses a book
- **THEN** that book becomes the sole book selected for this import

#### Scenario: Provider library is empty
- **GIVEN** the configured provider returns no books
- **WHEN** the book step loads
- **THEN** the wizard reports that no books are available
- **AND** prevents progress to the destination step

### Requirement: Annotation fetching follows provider capability
The wizard SHALL fetch a normalized snapshot of the selected book's **Book Annotation** records before confirmation when the provider supports early fetching and after confirmation otherwise.

#### Scenario: Provider supports early annotation fetching
- **GIVEN** the selected provider supports fetching annotations before confirmation
- **WHEN** the user selects a book
- **THEN** the wizard fetches that book's annotations before showing the destination and review steps
- **AND** the review shows the number of importable annotations

#### Scenario: Provider requires deferred annotation fetching
- **GIVEN** the selected provider cannot fetch annotations before confirmation
- **WHEN** the user confirms the review step
- **THEN** the wizard fetches that book's annotations before any note is written

#### Scenario: Yandex annotations are filtered to the selected book
- **GIVEN** Yandex Books returns annotations for multiple books
- **WHEN** the user selects one Yandex Books book
- **THEN** only annotations associated with the selected book are included in its import snapshot

### Requirement: Import includes highlights and attached comments
The import SHALL include annotation records containing highlighted text, an attached user comment, or both, and SHALL exclude records containing neither.

#### Scenario: Import highlighted text without a comment
- **GIVEN** the selected book has an annotation with highlighted text and no comment
- **WHEN** the annotation snapshot is prepared
- **THEN** the highlighted text is included as an importable annotation

#### Scenario: Import a comment without highlighted text
- **GIVEN** the selected book has an annotation with a user comment and no highlighted text
- **WHEN** the annotation snapshot is prepared
- **THEN** the user comment is included as an importable annotation

#### Scenario: Import highlighted text and its comment together
- **GIVEN** the selected book has an annotation with highlighted text and an attached comment
- **WHEN** the annotation snapshot is prepared
- **THEN** both values remain associated with the same importable annotation

#### Scenario: Ignore an empty provider record
- **GIVEN** the selected book has a record with neither highlighted text nor a user comment
- **WHEN** the annotation snapshot is prepared
- **THEN** that record is excluded from the import

#### Scenario: Selected book has no importable annotations
- **GIVEN** every record for the selected book lacks highlighted text and a user comment
- **WHEN** the annotation snapshot is prepared
- **THEN** the wizard reports that the book has no importable annotations
- **AND** no destination note is created or changed

### Requirement: User confirms the destination
The wizard SHALL let the user choose a vault folder, edit a default note filename, and review the import before writing.

#### Scenario: Use the configured default folder
- **GIVEN** the user has configured a default import folder and has not chosen a folder previously
- **WHEN** the Destination step opens
- **THEN** the configured default folder is preselected

#### Scenario: Remember the last destination folder
- **GIVEN** the user completed an earlier import to a different folder
- **WHEN** a later import reaches the Destination step
- **THEN** the most recently chosen folder is preselected

#### Scenario: Edit the default filename
- **GIVEN** the selected book is `Dune` by `Frank Herbert`
- **WHEN** the Destination step opens
- **THEN** `Frank Herbert - Dune.md` is offered as an editable filename
- **AND** invalid filename characters are removed or replaced before confirmation

#### Scenario: Review an early-fetched import
- **GIVEN** the selected provider supplied annotations before confirmation
- **WHEN** the Review step opens
- **THEN** it shows the provider, book, destination, and importable annotation count
- **AND** requires explicit confirmation before writing

### Requirement: Import completion is observable
The wizard SHALL preserve existing notes when an import fails and SHALL open the destination note after a successful import.

#### Scenario: Retry a provider failure
- **GIVEN** a provider request fails during the wizard
- **WHEN** the failure is reported
- **THEN** the current destination note remains unchanged
- **AND** the user can retry or cancel

#### Scenario: Complete an import
- **GIVEN** the selected book has a valid annotation snapshot and destination
- **WHEN** the user confirms the import and the note update succeeds
- **THEN** the destination note opens in Obsidian
- **AND** a success message reports the imported annotation count
