## 1. Remove the obsolete confirmation contract

- [ ] 1.1 Remove `confirmed` from `ExecuteRequest`, remove the `confirmation-required` import error and execution gate, and update all import use case and integration-test request fixtures.
- [ ] 1.2 Replace the confirmation-rejection test with direct-execution coverage and run the affected import and note integration tests.

## 2. Streamline the wizard controller

- [ ] 2.1 Remove the review state, review transition, confirmation action, and review-specific error handling from the import wizard controller.
- [ ] 2.2 Start the import directly from the destination action after path validation and sanitization, preserving prepared snapshots and deferred annotation fetching.
- [ ] 2.3 Preserve direct-import retry, back, cancellation, destination-conflict, and completion behavior; update the controller tests for valid, invalid, deferred, and failed imports.

## 3. Update the Obsidian modal

- [ ] 3.1 Remove the review renderer and progress segment, and change the destination primary action from `Review` to `Import`.
- [ ] 3.2 Update modal tests to verify the direct destination-to-importing flow, completion display, and unavailable cancellation while importing.

## 4. Verify the change

- [ ] 4.1 Run `npm test` and `npm run check` after the implementation and resolve any regressions.
- [ ] 4.2 Run `openspec validate final-approve-import-step-removal --type change --strict` before archive.
