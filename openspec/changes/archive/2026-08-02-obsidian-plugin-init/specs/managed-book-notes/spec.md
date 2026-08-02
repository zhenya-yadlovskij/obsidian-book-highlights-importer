## ADDED Requirements

### Requirement: Import creates one identified book note
Feature: Managed book notes

The plugin SHALL create one **Managed Book Note** for the selected provider and book identity.

#### Scenario: Create a new book note
- **GIVEN** the confirmed destination file does not exist
- **WHEN** the import is written
- **THEN** one Markdown note is created at the confirmed destination
- **AND** the note is identified by the selected provider and provider book ID

#### Scenario: Add structured source metadata
- **GIVEN** a new book note is being created
- **WHEN** the provider supplies title, authors, book ID, source URL, and status metadata
- **THEN** the available values are written to namespaced `book-highlights-` frontmatter fields
- **AND** the import time is recorded in a namespaced field

### Requirement: Generated content follows book structure
The plugin SHALL render a fixed Markdown structure that follows provider-supplied chapter or section hierarchy when available and preserves book order otherwise.

#### Scenario: Render provider chapter hierarchy
- **GIVEN** annotations include provider-supplied chapter or section paths
- **WHEN** the managed content is rendered
- **THEN** matching annotations are grouped under headings derived from those paths
- **AND** the headings follow book order

#### Scenario: Render without chapter metadata
- **GIVEN** annotations have progress or location but no chapter or section path
- **WHEN** the managed content is rendered
- **THEN** annotations appear in one Highlights section in book order
- **AND** no chapter name is invented

#### Scenario: Render a highlight with an attached comment
- **GIVEN** an annotation contains highlighted text and a user comment
- **WHEN** the managed content is rendered
- **THEN** the highlighted text is rendered as a Markdown blockquote
- **AND** its user comment is rendered as an attached note callout

#### Scenario: Render a comment-only annotation
- **GIVEN** an annotation contains a user comment without highlighted text
- **WHEN** the managed content is rendered
- **THEN** the comment is rendered as an annotation at its available book location

#### Scenario: Show best available location
- **GIVEN** an annotation has provider progress or location metadata
- **WHEN** the annotation is rendered
- **THEN** the available progress or location is shown with that annotation

### Requirement: Annotations use book order
The plugin SHALL order annotations by chapter, provider location, or reading progress, using creation time only to break equivalent positions.

#### Scenario: Creation order differs from book order
- **GIVEN** a later-created annotation occurs earlier in the book than an older annotation
- **WHEN** the managed content is rendered
- **THEN** the later-created annotation appears first because its book position is earlier

#### Scenario: Two annotations have the same book position
- **GIVEN** two annotations have equivalent chapter, location, and progress values
- **WHEN** the managed content is rendered
- **THEN** their creation times determine their stable order

### Requirement: Re-import updates only plugin-owned content
The plugin SHALL replace only the matching **Managed Section** and namespaced frontmatter fields when re-importing the same provider and book.

#### Scenario: Refresh a matching managed section
- **GIVEN** the destination note contains a managed section for the selected provider and book ID
- **WHEN** the same book is imported again
- **THEN** that managed section is replaced with the newly rendered snapshot
- **AND** no duplicate managed section is added

#### Scenario: Preserve user-authored body content
- **GIVEN** the destination note contains user-authored Markdown outside the matching managed section
- **WHEN** the same book is imported again
- **THEN** the user-authored Markdown remains unchanged

#### Scenario: Preserve user-owned frontmatter
- **GIVEN** the destination note contains tags, ratings, or other frontmatter keys not beginning with `book-highlights-`
- **WHEN** the same book is imported again
- **THEN** those user-owned frontmatter values remain unchanged
- **AND** only namespaced `book-highlights-` fields are refreshed

#### Scenario: Remove an annotation no longer returned by the provider
- **GIVEN** the existing managed section contains an annotation absent from the new provider snapshot
- **WHEN** the same book is imported again
- **THEN** the absent annotation is removed from the managed section
- **AND** content outside the managed section remains unchanged

### Requirement: Destination identity conflicts are rejected
The plugin SHALL refuse to write when an existing destination cannot be safely associated with the selected provider and book.

#### Scenario: Destination belongs to a different book
- **GIVEN** the chosen destination is identified with another provider or book ID
- **WHEN** the user confirms the import
- **THEN** the note remains unchanged
- **AND** the wizard requires a different filename

#### Scenario: Existing note has no managed identity
- **GIVEN** the chosen destination already exists without plugin identity metadata or managed markers
- **WHEN** the user confirms the import
- **THEN** the existing note remains unchanged
- **AND** the wizard requires a different filename

#### Scenario: Managed markers are malformed
- **GIVEN** the chosen destination has missing, duplicated, or ambiguously nested managed markers
- **WHEN** the user confirms a re-import
- **THEN** the note remains unchanged
- **AND** the wizard reports that the managed content cannot be updated safely

### Requirement: Note writes are atomic
The plugin SHALL validate and render the complete annotation snapshot before performing one vault create or update operation.

#### Scenario: Rendering fails before a new note is written
- **GIVEN** the selected annotation snapshot cannot be rendered completely
- **WHEN** the confirmed import is processed
- **THEN** no destination note is created
- **AND** the wizard reports the failure

#### Scenario: Rendering fails before an existing note is updated
- **GIVEN** a destination note already exists for the selected provider and book
- **AND** the new annotation snapshot cannot be rendered completely
- **WHEN** the confirmed import is processed
- **THEN** the existing note remains unchanged
