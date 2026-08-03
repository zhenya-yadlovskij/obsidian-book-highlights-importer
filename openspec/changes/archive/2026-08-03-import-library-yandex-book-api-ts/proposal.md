## Why

The plugin currently consumes `yandex-book-api-ts` from a checked-in local `.tgz` archive, which couples dependency installation to a repository artifact. The published npm package should be used instead so the dependency is installed through the standard npm registry workflow.

## What Changes

- Replace the local `file:./yandex-book-api-ts-0.0.3.tgz` dependency with the published `yandex-book-api-ts` npm package.
- Update the npm lockfile and dependency metadata to resolve the package from the registry.
- Remove the obsolete local package archive from the project if it is no longer needed.
- Preserve the existing Yandex Books API integration and runtime behavior.

## Capabilities

### New Capabilities

None. This is a dependency-source migration with no new user-facing behavior.

### Modified Capabilities

None. Existing Yandex Books import behavior is intentionally unchanged.

## Impact

- `package.json` and `package-lock.json` dependency resolution.
- Project distribution and clean-install workflows, which will require access to the npm registry rather than the checked-in archive.
- Existing TypeScript imports and Yandex Books integration are expected to remain unchanged.
