## 1. Retire the runtime compatibility workflow

- [ ] 1.1 Remove the runtime compatibility command registration and harness-only startup dependencies from the plugin entry point.
- [ ] 1.2 Delete the runtime compatibility modal and Yandex runtime harness modules after confirming they have no remaining consumers.

## 2. Preserve supported plugin behavior

- [ ] 2.1 Update plugin lifecycle tests to assert that only `Import Book Highlights` is registered and still opens and unloads correctly.
- [ ] 2.2 Remove harness-specific tests, mocks, and the runtime-observations fixture that no longer support production behavior.

## 3. Verify the removal

- [ ] 3.1 Run the relevant test suites and `npm run check` to verify the supported import workflow and release build.
- [ ] 3.2 Run `openspec validate remove-runtime-compatibility-check --type change --strict` before archiving.
