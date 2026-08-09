## ADDED Requirements

### Requirement: Find plugin configuration in settings search
The plugin SHALL expose its default-folder, Yandex OAuth, and registered-provider configuration through settings search on Obsidian `1.13.0` and later.

#### Scenario: Search for the default import folder
- **GIVEN** a user runs Obsidian version `1.13.0` or later
- **WHEN** the user searches settings for "default import folder"
- **THEN** the **Vault-relative folder** configuration is shown

#### Scenario: Search for Yandex authorization guidance
- **GIVEN** a user runs Obsidian version `1.13.0` or later
- **WHEN** the user searches settings for "Yandex OAuth token"
- **THEN** the **Yandex OAuth token** guidance and configuration are shown

#### Scenario: Search for a registered provider
- **GIVEN** a **Reading Provider** is registered by the plugin
- **WHEN** the user searches settings for that provider's display name
- **THEN** the provider's **Provider Credential** configuration is shown

### Requirement: Preserve searchable configuration behavior
The plugin SHALL preserve provider credential handling and default-folder updates when configuration is rendered through settings search.

#### Scenario: Configure a provider through its search result
- **GIVEN** a user has located a provider's configuration through settings search
- **WHEN** the user saves a replacement **Provider Credential**
- **THEN** the provider is shown as configured
- **AND** the saved credential is not displayed

#### Scenario: Update the default import folder through its search result
- **GIVEN** a user has located the **Vault-relative folder** configuration through settings search
- **WHEN** the user selects a folder suggestion
- **THEN** the selected folder is saved as the default import folder
