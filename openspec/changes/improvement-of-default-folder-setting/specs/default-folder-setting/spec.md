## ADDED Requirements

### Requirement: Configure a default import folder without an explicit save action
The plugin SHALL let a user configure a **Vault-relative folder** as the default import folder without requiring an explicit Save action, and SHALL persist the most recent value after the user pauses typing.

#### Scenario: Save the typed default folder after a pause
- **GIVEN** the user is viewing the default import folder setting
- **WHEN** the user enters `Books/To Read` and pauses typing
- **THEN** `Books/To Read` is saved as the default import folder
- **AND** the setting does not show a Save button

#### Scenario: Preserve the most recent typed folder
- **GIVEN** the user changes the default import folder more than once before saving completes
- **WHEN** the user pauses after entering `Books/Finished`
- **THEN** `Books/Finished` is the saved default import folder
- **AND** an earlier value does not replace it

#### Scenario: Report a failed automatic save
- **GIVEN** the user has changed the default import folder
- **WHEN** the plugin cannot save the changed folder after the user pauses typing
- **THEN** the user is told that the default import folder could not be saved
- **AND** the setting remains available for correction or another save attempt

### Requirement: Suggest matching vault folders while allowing new paths
The plugin SHALL suggest existing **Vault-relative folder** paths that match the user's default-folder input, including nested folders, and SHALL continue to accept a valid typed path that has no matching existing folder.

#### Scenario: Show matching nested folder suggestions
- **GIVEN** the vault contains `Books`, `Books/To Read`, and `Archive`
- **WHEN** the user enters `Books/To`
- **THEN** `Books/To Read` is offered as a matching folder suggestion
- **AND** `Archive` is not offered as a matching folder suggestion

#### Scenario: Choose a suggested folder
- **GIVEN** `Books/To Read` is offered as a matching folder suggestion
- **WHEN** the user chooses that suggestion
- **THEN** the default import folder input contains `Books/To Read`
- **AND** the chosen path is saved after the user pauses typing

#### Scenario: Keep a new typed folder path
- **GIVEN** no vault folder matches `Books/Unsorted`
- **WHEN** the user enters `Books/Unsorted` as the default import folder
- **THEN** the input retains `Books/Unsorted`
- **AND** the path is saved as the default import folder after the user pauses typing

## MODIFIED Requirements

## REMOVED Requirements
