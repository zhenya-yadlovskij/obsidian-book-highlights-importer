## ADDED Requirements

### Requirement: Retrieve quotes for the selected Yandex Books book
The Yandex Books **Provider Adapter** SHALL retrieve one CSV quote export scoped to the selected book and SHALL use that export as the sole source of annotations for the **Import Snapshot**.

#### Scenario: Retrieve the selected book's export
- **GIVEN** a user selects a Yandex Books book with a provider book ID
- **WHEN** the plugin prepares that book's annotations
- **THEN** the plugin requests the CSV quote export for that provider book ID
- **AND** every imported annotation comes from that export

#### Scenario: Selected-book export fails
- **GIVEN** Yandex Books cannot provide the selected book's CSV quote export
- **WHEN** the plugin prepares that book's annotations
- **THEN** the import reports a safe provider failure
- **AND** the plugin does not fall back to account-wide quote retrieval
- **AND** no partial **Import Snapshot** is produced

### Requirement: Accept the documented CSV export structure
The **Provider Adapter** SHALL require the fields `book_title`, `book_authors`, `content`, `comment`, `color`, and `created_at`, SHALL accept additional fields, and SHALL decode CSV quoting without corrupting exported annotation text.

#### Scenario: Parse representative exported values
- **GIVEN** a selected-book export contains Unicode text, quoted commas, escaped quotes, an embedded newline, and an empty comment
- **WHEN** the plugin prepares the export
- **THEN** each value is parsed into its original text
- **AND** the empty comment remains absent from its **Book Annotation**

#### Scenario: Accept an additive export field
- **GIVEN** a selected-book export contains all required fields and an additional field
- **WHEN** the plugin prepares the export
- **THEN** the additional field does not prevent a complete **Import Snapshot**

#### Scenario: Reject a missing required field
- **GIVEN** a selected-book export omits one required field
- **WHEN** the plugin prepares the export
- **THEN** the import reports incomplete provider data
- **AND** no annotations from that export are returned

#### Scenario: Reject malformed CSV
- **GIVEN** a selected-book export contains an unterminated quoted value after valid rows
- **WHEN** the plugin prepares the export
- **THEN** the import reports incomplete provider data
- **AND** no annotations from the valid prefix are returned

### Requirement: Map complete export rows to annotations
The **Provider Adapter** SHALL map non-blank exported content and comments to **Book Annotation** records, exclude rows where both values are blank, and retain the selected library book's metadata as the **Import Snapshot** book identity.

#### Scenario: Map a highlight and attached comment
- **GIVEN** an export row contains highlighted content and an attached comment
- **WHEN** the plugin prepares the export
- **THEN** one **Book Annotation** contains both values

#### Scenario: Map a comment-only row
- **GIVEN** an export row has a blank content value and a non-blank comment
- **WHEN** the plugin prepares the export
- **THEN** one comment-only **Book Annotation** is included

#### Scenario: Exclude an empty row
- **GIVEN** an export row has blank content and comment values
- **WHEN** the plugin prepares the export
- **THEN** that row is excluded from the **Import Snapshot**

#### Scenario: Keep selected library metadata
- **GIVEN** exported book title and author text differ from the selected library book's metadata
- **WHEN** the plugin prepares the export
- **THEN** the **Import Snapshot** retains the selected library book's title and authors
- **AND** exported color does not alter the **Book Annotation**

### Requirement: Order exported annotations chronologically
The plugin SHALL order exported **Book Annotation** records with valid creation timestamps from oldest to newest, preserve export row order for equal timestamps, and place undated records after dated records in export row order.

#### Scenario: Order timestamps by their absolute time
- **GIVEN** one export row was created at `2025-01-01 10:00:00 +0300`
- **AND** a second export row was created at `2025-01-01 08:30:00 +0000`
- **WHEN** the plugin prepares the export
- **THEN** the `2025-01-01 10:00:00 +0300` annotation appears first

#### Scenario: Preserve row order for equal timestamps
- **GIVEN** two export rows have the same valid creation timestamp
- **WHEN** the plugin prepares the export
- **THEN** those annotations retain their export row order

#### Scenario: Place undated annotations last
- **GIVEN** an export contains dated rows and rows with blank or invalid creation timestamps
- **WHEN** the plugin prepares the export
- **THEN** dated annotations appear first from oldest to newest
- **AND** undated annotations follow in their export row order

### Requirement: Preserve records without source identifiers
The **Provider Adapter** SHALL preserve importable export rows without fabricating source identifiers or deduplicating records that cannot be proven identical by a provider-owned identity.

#### Scenario: Preserve identical rows without identifiers
- **GIVEN** two importable export rows have identical field values and no source identifiers
- **WHEN** the plugin prepares the export
- **THEN** both rows are included as separate **Book Annotation** records
- **AND** neither annotation is assigned a fabricated source identifier
