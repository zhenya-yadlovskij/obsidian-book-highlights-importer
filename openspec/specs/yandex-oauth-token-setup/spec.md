# Yandex OAuth Token Setup

## Purpose

Define the Yandex Books settings guidance for obtaining and securely saving a **Yandex OAuth token**.

## Requirements

### Requirement: Guide Yandex OAuth token setup
The plugin SHALL provide Yandex Books-specific guidance that enables a user to obtain and save a **Yandex OAuth token** without exposing the token after entry.

#### Scenario: View setup guidance before configuring Yandex Books
- **GIVEN** Yandex Books has no saved **Yandex OAuth token**
- **WHEN** the user opens the plugin settings
- **THEN** the Yandex Books token field has the placeholder `Yandex OAuth token`
- **AND** the settings explain that the user must authorize Yandex, copy the `y0_...` token from the resulting browser URL, and paste it into the field

#### Scenario: Obtain a Yandex OAuth token from settings
- **GIVEN** the user opens the Yandex Books settings
- **WHEN** the user chooses `Get Yandex OAuth token`
- **THEN** the plugin opens `https://oauth.yandex.ru/authorize?response_type=token&client_id=4483e97bab6e486a9822973109a14d05` in the user's external browser

#### Scenario: Replace an existing Yandex OAuth token
- **GIVEN** Yandex Books has a saved **Yandex OAuth token**
- **WHEN** the user opens the plugin settings
- **THEN** the token field has the placeholder `Yandex OAuth token`
- **AND** the saved token is not displayed
- **AND** the settings continue to explain how to authorize Yandex and paste a replacement token

#### Scenario: Save a token obtained through the authorization flow
- **GIVEN** the user has authorized Yandex and copied a `y0_...` token
- **WHEN** the user pastes the token and saves the Yandex Books setting
- **THEN** the plugin reports that Yandex Books is configured
- **AND** the token is retained as a **Provider Credential** without being displayed in settings

#### Scenario: Authorization does not automatically capture a token
- **GIVEN** the user chooses `Get Yandex OAuth token`
- **WHEN** the external browser finishes Yandex authorization
- **THEN** the plugin does not receive or save a token automatically
- **AND** the user can paste the copied token into the Yandex Books settings
