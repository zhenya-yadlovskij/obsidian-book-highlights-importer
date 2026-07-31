## ADDED Requirements

### Requirement: Built-in providers expose configuration
Feature: Reading provider configuration

The plugin SHALL expose configuration and connection status for every built-in **Provider Adapter**, starting with Yandex Books.

#### Scenario: Yandex Books is available for configuration
- **GIVEN** the plugin is enabled
- **WHEN** the user opens the plugin settings
- **THEN** Yandex Books is listed as a configurable **Reading Provider**
- **AND** its current connection status is shown

#### Scenario: A future built-in provider has separate configuration
- **GIVEN** more than one built-in reading provider is registered
- **WHEN** the user opens the plugin settings
- **THEN** each reading provider has its own configuration and connection status

### Requirement: Provider credentials use protected storage
Rule: Raw credentials are not ordinary plugin preferences

The plugin SHALL store each **Provider Credential** through Obsidian SecretStorage and SHALL keep raw credential values out of ordinary plugin settings.

#### Scenario: Save a Yandex Books credential
- **GIVEN** Yandex Books has no configured credential
- **WHEN** the user saves an OAuth token for Yandex Books
- **THEN** Yandex Books is shown as configured after settings are reopened
- **AND** the raw token is absent from ordinary plugin settings

#### Scenario: Saved credential is not redisplayed
- **GIVEN** Yandex Books has a configured credential
- **WHEN** the user reopens the Yandex Books settings
- **THEN** the settings show that a credential exists without displaying its raw value

#### Scenario: Replace a provider credential
- **GIVEN** Yandex Books has a configured credential
- **WHEN** the user replaces it with a new OAuth token
- **THEN** subsequent Yandex Books operations use the replacement credential

#### Scenario: Clear a provider credential
- **GIVEN** Yandex Books has a configured credential
- **WHEN** the user clears it
- **THEN** Yandex Books is shown as not configured
- **AND** imports cannot use the cleared credential

### Requirement: Users can test provider access
The plugin SHALL let the user test a configured reading provider without starting an import.

#### Scenario: Test a valid Yandex Books credential
- **GIVEN** Yandex Books has a valid configured OAuth token
- **WHEN** the user tests the Yandex Books connection
- **THEN** the settings report a successful connection

#### Scenario: Test a rejected Yandex Books credential
- **GIVEN** Yandex Books has a configured OAuth token that the provider rejects
- **WHEN** the user tests the Yandex Books connection
- **THEN** the settings report that authentication failed
- **AND** the message does not reveal the OAuth token

#### Scenario: Test fails because the provider is unavailable
- **GIVEN** Yandex Books has a configured credential
- **WHEN** the connection test cannot reach the provider
- **THEN** the settings distinguish the connection failure from invalid authentication
- **AND** the user can retry the test

### Requirement: Import requires provider configuration
The plugin SHALL stop before loading provider data when the selected reading provider lacks a usable credential.

#### Scenario: Start an import without a Yandex Books credential
- **GIVEN** Yandex Books is not configured
- **WHEN** the user selects Yandex Books in the import wizard
- **THEN** the wizard explains that configuration is required
- **AND** no Yandex Books library data is requested

#### Scenario: Stored credential expires before import
- **GIVEN** Yandex Books has a stored credential that the provider no longer accepts
- **WHEN** the wizard tries to load the Yandex Books library
- **THEN** the wizard reports an authentication failure
- **AND** directs the user to replace or test the credential
