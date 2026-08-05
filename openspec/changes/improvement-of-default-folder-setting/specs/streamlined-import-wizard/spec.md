## ADDED Requirements

### Requirement: Create missing destination folders before import
The plugin SHALL create the complete missing **Vault-relative folder** hierarchy for a valid import destination before creating or updating its **Managed Book Note**.

#### Scenario: Import to a missing default-folder path
- **GIVEN** the default import folder is `Books/Unsorted`
- **AND** `Books/Unsorted` does not exist in the vault
- **WHEN** the user imports a book without changing the destination
- **THEN** the plugin creates `Books/Unsorted`
- **AND** the **Managed Book Note** is imported into `Books/Unsorted`

#### Scenario: Import to a missing folder typed in the destination step
- **GIVEN** the user has selected a provider and book
- **AND** the user has entered the valid destination folder `Books/2026/Finished`
- **AND** `Books/2026/Finished` does not exist in the vault
- **WHEN** the user chooses Import
- **THEN** the plugin creates the missing folder hierarchy
- **AND** the **Managed Book Note** is imported into `Books/2026/Finished`

#### Scenario: Handle a folder-creation failure
- **GIVEN** the user has selected a valid destination in a missing folder
- **AND** the plugin cannot create the destination folder hierarchy
- **WHEN** the user chooses Import
- **THEN** no **Managed Book Note** is created or updated at that destination
- **AND** the user is shown an import error with a retry action

## MODIFIED Requirements

## REMOVED Requirements
