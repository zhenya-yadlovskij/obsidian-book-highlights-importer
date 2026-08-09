## ADDED Requirements

### Requirement: Publish review-compliant patch release metadata
The plugin SHALL build release metadata for version `0.1.1` that requires Obsidian `1.13.0` and does not use "Obsidian" in its manifest description.

#### Scenario: Build the `0.1.1` patch release
- **GIVEN** the plugin source is prepared for the next patch release
- **WHEN** the release artifacts are built
- **THEN** the manifest version is `0.1.1`
- **AND** the version metadata maps `0.1.1` to minimum app version `1.13.0`
- **AND** the manifest description does not contain the word "Obsidian"

#### Scenario: Publish the patch release
- **GIVEN** the `0.1.1` release artifacts have passed local verification
- **WHEN** the maintainer creates the GitHub release
- **THEN** the release name includes `0.1.1`

### Requirement: Use review-compliant platform APIs
The plugin SHALL use Obsidian-compatible DOM and active-window timer APIs for review-listed UI behavior.

#### Scenario: Render a book-result container and folder suggestion
- **GIVEN** a user views book results or folder suggestions
- **WHEN** the plugin creates the required container
- **THEN** the plugin uses an Obsidian DOM helper to create the container

#### Scenario: Save the default import folder in an Obsidian window
- **GIVEN** a user changes the default import folder
- **WHEN** the delayed save is scheduled or cancelled
- **THEN** the plugin uses the active Obsidian window's timer APIs

#### Scenario: Open Yandex authorization
- **GIVEN** a user requests a Yandex OAuth token
- **WHEN** the plugin opens the authorization URL
- **THEN** the external browser opens without direct document element construction
