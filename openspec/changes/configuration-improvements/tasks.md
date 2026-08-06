## 1. Specify and implement Yandex token setup

- [ ] 1.1 Extend `tests/obsidian/provider-settings-tab.test.ts` test doubles and add failing scenarios for Yandex Books setup guidance, the `Yandex OAuth token` placeholder for both new and replacement tokens, token redaction, and the `Get Yandex OAuth token` action opening the documented authorization URL.
- [ ] 1.2 Update `src/obsidian/provider-settings-tab.ts` to render Yandex-specific authorization instructions and the external authorization action while preserving the existing password input, save, clear, connection-test, and **Provider Credential** storage behavior.
- [ ] 1.3 Run `npm test -- tests/obsidian/provider-settings-tab.test.ts` and confirm all settings-tab scenarios pass.

## 2. Validate the change

- [ ] 2.1 Run `npm run check` and resolve any type, lint, test, build, or release-verification failures caused by the settings change.
- [ ] 2.2 Run `openspec validate configuration-improvements --type change --strict` and resolve any change-artifact validation failures.
