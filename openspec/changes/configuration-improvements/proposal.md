## Why

Setting up Yandex Books currently requires users to discover how to obtain an OAuth token themselves, while the generic credential field does not identify the required value. Clear, direct setup guidance reduces friction and prevents users from entering the wrong credential.

## What Changes

- Make the Yandex Books settings identify the secret field as a **Yandex OAuth token**, including when replacing an existing token.
- Add concise setup instructions explaining that users authorize Yandex, copy the `y0_...` token from the resulting browser URL, and paste it into the field.
- Add a settings action that opens Yandex's documented authorization URL directly.
- Keep token acquisition manual after authorization; the plugin will not implement an OAuth callback, automatic token capture, or token refresh.

## Capabilities

### New Capabilities
- `yandex-oauth-token-setup`: Guide users through obtaining and securely saving a Yandex OAuth token from the Yandex Books settings.

### Modified Capabilities
- None.

## Impact

- `src/obsidian/provider-settings-tab.ts` and its settings-tab tests.
- Obsidian's external-link opening API and the documented Yandex authorization URL.
- Existing secure **Provider Credential** storage continues to store the entered token without displaying it.
