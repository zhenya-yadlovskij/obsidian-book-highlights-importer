## 1. Migrate the dependency source

- [ ] 1.1 Run `npm install yandex-book-api-ts` from the repository root and let npm replace the local file dependency in `package.json` and `package-lock.json`.
- [ ] 1.2 Confirm `package.json` names the published `yandex-book-api-ts` package without a `file:` spec, and confirm `package-lock.json` records the resolved registry URL, version, integrity metadata, and transitive dependencies.
- [ ] 1.3 Inspect the installed package exports and run `npm run typecheck` to confirm the existing imports in `src/obsidian/yandex-client.ts`, `src/providers/yandex.ts`, and `src/compatibility/yandex-runtime.ts` remain compatible without source changes.

## 2. Verify behavior and remove the archive

- [ ] 2.1 Run `npm run lint`, `npm test`, `npm run build`, and `npm run verify:release` while the local archive is still present; record and resolve any failure caused by the registry package before cleanup.
- [ ] 2.2 Remove `yandex-book-api-ts-0.0.3.tgz` after the registry-backed dependency passes verification.
- [ ] 2.3 Search the repository and dependency metadata for `yandex-book-api-ts-0.0.3.tgz` and confirm no active install, build, or release path references the deleted archive.
- [ ] 2.4 Run `npm ci` from a clean dependency state to prove the lockfile installs the registry package without the local archive.
- [ ] 2.5 Run `npm run check` after archive removal and confirm typecheck, lint, tests, build, and release verification all pass together.

## 3. Validate the completed change

- [ ] 3.1 Run `openspec validate import-library-yandex-book-api-ts --type change --strict` and resolve any artifact or dependency validation errors.
- [ ] 3.2 Review the final diff to confirm only dependency metadata, lockfile data, the obsolete archive removal, and required change artifacts are included; confirm Yandex Books source imports and runtime behavior were not changed.
