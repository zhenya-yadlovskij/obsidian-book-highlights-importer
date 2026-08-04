# Managed Note Properties

## Purpose

Define generated book-property names, values, and re-import ownership for a Managed Book Note.

## Requirements

### Requirement: Generate compact book metadata
The plugin SHALL write book metadata on each newly created **Managed Book Note** using the `bh-` property prefix.

#### Scenario: Create a note with the supported metadata
- **GIVEN** a user imports a book with provider, book ID, title, and authors
- **WHEN** the plugin creates the **Managed Book Note**
- **THEN** its frontmatter contains `bh-provider`, `bh-book-id`, `bh-title`, and `bh-authors`
- **AND** its `bh-imported-at` value is a UTC ISO 8601 value compatible with an **Obsidian DateTime property**
- **AND** its frontmatter does not contain `bh-status` or `bh-source-url`

### Requirement: Preserve legacy and user properties during re-import
The plugin SHALL update only its current `bh-*` properties when re-importing a **Managed Book Note**.

#### Scenario: Re-import a note with legacy and user properties
- **GIVEN** a **Managed Book Note** contains current `bh-*` properties, legacy `book-highlights-*` properties, and user-defined properties
- **WHEN** the user re-imports the same book with updated metadata
- **THEN** the `bh-*` properties reflect the updated import
- **AND** the legacy `book-highlights-*` properties are unchanged
- **AND** the user-defined properties are unchanged
