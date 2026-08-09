# Obsidian Publishing Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an Obsidian-review-ready `0.1.1` release with no review errors or warnings.

**Architecture:** Update release metadata and the release verifier together so the built artifact remains internally consistent. Move the settings tab to declarative definitions backed by renderers, retaining existing dynamic control behavior while making all settings searchable. Replace review-listed DOM and timer APIs with Obsidian-compatible helpers.

**Tech Stack:** TypeScript, Obsidian Plugin API 1.13.0, Vitest, ESLint, esbuild.

## Global Constraints

- The release version is `0.1.1` in `manifest.json`, `versions.json`, and `package.json`.
- `manifest.json` uses `minAppVersion` `1.13.0` and its description does not contain the word "Obsidian".
- The settings tab has no pre-1.13 compatibility path.
- Preserve existing credential redaction, connection-test race protection, folder suggestions, and delayed folder persistence.
- Use Obsidian DOM helpers at every review-listed location and use `window.setTimeout` and `window.clearTimeout` for popup-window compatibility.
- Do not add GitHub release automation, artifact attestations, or release-asset cleanup.
- Do not create commits unless the user explicitly requests them.

---

### Task 1: Align Patch Release Metadata

**Files:**
- Modify: `manifest.json:4-6`
- Modify: `package.json:2-4`
- Modify: `versions.json:1-3`
- Modify: `scripts/verify-release.mjs:18-29`

**Interfaces:**
- Consumes: the release verifier's existing `manifest.version` to minimum-version mapping.
- Produces: release metadata that declares version `0.1.1` and Obsidian 1.13.0 as the minimum supported application.

- [ ] **Step 1: Add the failing release-metadata assertions to `scripts/verify-release.mjs`**

```js
if (manifest.version !== "0.1.1") {
  throw new Error("Release manifest must declare version 0.1.1.");
}
if (manifest.minAppVersion !== "1.13.0") {
  throw new Error("Release manifest must require Obsidian 1.13.0.");
}
if (/obsidian/i.test(manifest.description)) {
  throw new Error("Release manifest description must not contain Obsidian.");
}
```

- [ ] **Step 2: Run the verifier to confirm it fails against the current `0.1.0` metadata**

Run: `npm run build && npm run verify:release`

Expected: FAIL because the generated manifest still declares `0.1.0` and `1.11.4`.

- [ ] **Step 3: Update the three metadata sources and the verifier's version-map assertion**

```json
// manifest.json
"version": "0.1.1",
"minAppVersion": "1.13.0",
"description": "Import book highlights and notes into managed Markdown sections."
```

```json
// versions.json
{ "0.1.1": "1.13.0" }
```

```json
// package.json
"version": "0.1.1"
```

- [ ] **Step 4: Rebuild and verify the release artifact**

Run: `npm run build && npm run verify:release`

Expected: PASS and report the three required release files.

### Task 2: Replace Review-Listed UI APIs

**Files:**
- Modify: `src/obsidian/import-modal.ts:152`
- Modify: `src/obsidian/obsidian-folder-suggest.ts:26`
- Modify: `src/obsidian/provider-settings-tab.ts:55-63,195-221`
- Modify: `tests/obsidian/import-modal.test.ts:33-65`
- Modify: `tests/obsidian/provider-settings-tab.test.ts:101-174`

**Interfaces:**
- Consumes: Obsidian's `HTMLElement.createDiv()` and `HTMLElement.createEl()` helpers, plus the active window's timer functions.
- Produces: equivalent modal, suggestion, OAuth-link, and default-folder debounce behavior without direct document construction or global timer calls.

- [ ] **Step 1: Extend the test doubles with failing helper expectations**

```ts
createDiv(options?: { text?: string }): FakeElement {
  const child = new FakeElement(this);
  child.text = options?.text ?? "";
  this.children.push(child);
  return child;
}
```

Add assertions that the book-results and suggestion containers are created with `createDiv`, and that the OAuth action creates and removes a temporary anchor through the tab container.

- [ ] **Step 2: Run the focused UI tests to confirm the new assertions fail**

Run: `npx vitest run tests/obsidian/import-modal.test.ts tests/obsidian/provider-settings-tab.test.ts`

Expected: FAIL because production code still calls generic `createEl("div")`, directly creates the OAuth anchor, and calls unqualified timer functions.

- [ ] **Step 3: Use the specific Obsidian element helpers and active-window timers**

```ts
this.bookResultsEl = this.contentEl.createDiv();
el.createDiv({ text: value });
const link = this.containerEl.createEl("a");
```

Keep the current `target`, `rel`, click, and removal behavior for the temporary OAuth link. Replace `saveTimer = setTimeout(` with `saveTimer = window.setTimeout(` and replace both `clearTimeout(saveTimer)` calls with `window.clearTimeout(saveTimer)`.

- [ ] **Step 4: Run the focused UI tests**

Run: `npx vitest run tests/obsidian/import-modal.test.ts tests/obsidian/provider-settings-tab.test.ts`

Expected: PASS with the same user-visible modal, suggestion, OAuth, and delayed-save behavior.

### Task 3: Make Settings Searchable Through Declarative Definitions

**Files:**
- Modify: `src/obsidian/provider-settings-tab.ts:1-292`
- Modify: `tests/obsidian/provider-settings-tab.test.ts:36-695`

**Interfaces:**
- Consumes: `PluginSettingTab.getSettingDefinitions(): SettingDefinitionItem[]` available from Obsidian 1.13.0.
- Produces: definitions for the default folder, Yandex OAuth guidance, and each registered provider, each with searchable names and descriptions and a renderer preserving the current controls.

- [ ] **Step 1: Add a failing declarative-settings test**

```ts
it("returns searchable definitions for the default folder and registered providers", () => {
  const tab = new BookHighlightsSettingsTab(
    {} as App,
    {} as Plugin,
    createProviderRegistry([provider("yandex-books", "Yandex Books")]),
    { get: (): null => null, set: vi.fn(), clear: vi.fn() },
    { testCredential: vi.fn() },
    settingsRepository(),
  );
  expect(tab.getSettingDefinitions()).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Default import folder", searchable: true }),
    expect.objectContaining({ name: "Yandex OAuth token", searchable: true }),
    expect.objectContaining({ name: "Yandex Books", searchable: true }),
  ]));
});
```

Add test-double support for the definition renderer's setting container and adapt existing tests to render definitions rather than invoking `display()`.

- [ ] **Step 2: Run the settings-tab test to confirm it fails**

Run: `npx vitest run tests/obsidian/provider-settings-tab.test.ts`

Expected: FAIL because `BookHighlightsSettingsTab` does not implement `getSettingDefinitions()`.

- [ ] **Step 3: Implement declarative definitions with renderers**

```ts
override getSettingDefinitions(): SettingDefinitionItem[] {
  return [
    { name: "Default import folder", desc: "Vault-relative folder used before any successful import.", searchable: true, render: (setting) => this.renderDefaultFolder(setting.settingEl) },
    { name: "Yandex OAuth token", desc: "Authorize Yandex, copy the y0_... token from the browser URL, and paste it into the field.", searchable: true, render: (setting) => this.renderYandexOAuthSetup(setting.settingEl) },
    ...this.providerDefinitions(),
  ];
}

private providerDefinitions(): SettingDefinitionRender[] {
  return this.registry.all().map((provider) => ({
    name: provider.displayName,
    desc: "Configure, replace, clear, or test this provider credential.",
    searchable: true,
    render: (setting) => this.renderProviderSetting(setting.settingEl, provider),
  }));
}
```

Refactor the existing render methods to receive their definition-owned container instead of clearing and rebuilding the whole tab. Preserve cleanup in `hide()`, provider credential isolation, connection-test generation checks, and the 300 ms folder-save debounce.

- [ ] **Step 4: Run the settings-tab tests**

Run: `npx vitest run tests/obsidian/provider-settings-tab.test.ts`

Expected: PASS, including the existing redaction, race-condition, folder suggestion, loading failure, and save failure cases.

### Task 4: Run the Full Release Gate and Publish Manually

**Files:**
- Modify: generated `dist/main.js`, `dist/manifest.json`, `dist/versions.json` via `npm run build`
- GitHub: create a new release named `Initial community release 0.1.1`

**Interfaces:**
- Consumes: the metadata, UI, and settings changes from Tasks 1-3.
- Produces: a review submission for version `0.1.1` with no reported errors or warnings.

- [ ] **Step 1: Run the complete local gate**

Run: `npm run check`

Expected: PASS for TypeScript, ESLint, Vitest, the production build, and release verification.

- [ ] **Step 2: Inspect the built release metadata**

Run: `node -e 'const m=require("./dist/manifest.json"); if (m.version !== "0.1.1" || m.minAppVersion !== "1.13.0" || /obsidian/i.test(m.description)) process.exit(1)'`

Expected: exit status 0.

- [ ] **Step 3: Publish and review the patched release**

Create the GitHub release with the built `main.js`, `manifest.json`, and `versions.json` assets and name it `Initial community release 0.1.1`. Submit that release to the Obsidian plugin review.

Expected: the fresh review reports no errors or warnings. Ignore only the two explicitly out-of-scope recommendations: artifact attestations and the `versions.json` release asset.
