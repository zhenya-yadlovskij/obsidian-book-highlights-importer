# ADR-0002: Store Provider Credentials in Obsidian SecretStorage

- Status: accepted
- Date: 2026-07-31
- Supersedes: none

## Context and Problem Statement

Each **Provider Adapter** may need authentication that users should configure once and reuse. A raw **Provider Credential** must not be stored with ordinary plugin settings, but the plugin must work on Obsidian desktop and mobile without inventing an insecure encryption-key scheme.

## Considered Options

- Obsidian SecretStorage with Obsidian 1.11.4 as the minimum version
- Raw credentials in plugin `loadData()` storage
- Plugin-controlled encryption with a stored key or user-entered master passphrase
- Prompt for credentials on every import

## Decision Outcome

Chosen option: "Obsidian SecretStorage with Obsidian 1.11.4 as the minimum version", because it delegates secret handling to the host platform, keeps raw credentials out of ordinary settings, and avoids requiring a master passphrase for every application session.

### Consequences

- Good, because ordinary plugin settings contain only non-secret preferences.
- Good, because provider configuration can be reused across import commands on each configured device.
- Bad, because the plugin depends on Obsidian 1.11.4 or newer.
- Bad, because SecretStorage does not publicly guarantee encryption, synchronization, deletion, or identical platform behavior; credentials are treated as per-device and blanked when cleared.
