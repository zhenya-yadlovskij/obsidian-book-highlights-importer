# Streamlined Import Wizard

## Purpose

Define the direct import flow from a validated destination.

## Requirements

### Requirement: Start an import from a validated destination
The plugin SHALL let a user start an import from the destination step without a separate final review or confirmation step.

#### Scenario: Import from a valid destination
- **GIVEN** a user has selected a provider and book
- **AND** the user has chosen a valid destination for the **Managed Book Note**
- **WHEN** the user chooses Import
- **THEN** the plugin starts the import directly
- **AND** no separate review or confirmation screen is shown

#### Scenario: Correct an invalid destination before import
- **GIVEN** a user has selected a provider and book
- **AND** the user has entered an invalid destination
- **WHEN** the user chooses Import
- **THEN** the import does not start
- **AND** the user is told to correct the destination

### Requirement: Preserve import outcome handling
The plugin SHALL preserve its existing completion, error, retry, back, and cancellation behavior after an import starts from the destination step.

#### Scenario: Complete a direct import
- **GIVEN** an import has started from a valid destination
- **WHEN** the import completes successfully
- **THEN** the user is shown the completed **Managed Book Note** destination and import result

#### Scenario: Handle a direct import failure
- **GIVEN** an import has started from a valid destination
- **WHEN** the import cannot complete
- **THEN** the user is shown the applicable import error
- **AND** the user can use the error actions supported for that failure
