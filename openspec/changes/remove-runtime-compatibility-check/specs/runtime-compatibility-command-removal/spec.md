## ADDED Requirements

### Requirement: Retire the manual runtime compatibility command
Feature: Supported plugin commands

The plugin SHALL not expose the retired runtime compatibility harness to users after its compatibility validation is complete.

#### Scenario: User views the plugin commands
- **GIVEN** the Book Highlights Importer plugin is loaded
- **WHEN** a user views its available commands
- **THEN** `Open runtime compatibility harness` is not available
- **AND** `Import Book Highlights` remains available

## MODIFIED Requirements

## REMOVED Requirements
