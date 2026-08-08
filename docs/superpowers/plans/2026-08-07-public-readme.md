# Public README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an accurate, user-first README for the Yandex Books import workflow and license the project under MIT.

**Architecture:** Keep all user and contributor guidance in the root `README.md`, with intentional HTML media comments that do not render broken images before assets exist. Add the standard MIT text in `LICENSE` and record reused domain terminology in `README-glossary-reference.md`; do not change plugin behavior or project metadata.

**Tech Stack:** GitHub-flavored Markdown, HTML comments, MIT License text, npm project verification

## Global Constraints

- Write the public documentation in English only.
- Document Yandex Books as the only supported Reading Provider.
- Document only behavior verified in source and current OpenSpec artifacts.
- State that manual source installation is currently available; do not claim an existing GitHub release or Community Plugins publication.
- Target Obsidian 1.11.4 or newer and describe both desktop and mobile support.
- Reserve `docs/assets/book-highlights-importer-demo.gif` and `docs/assets/generated-book-note.png` with non-rendering HTML comments, not fake files or broken image links.
- Use `Copyright (c) 2026 Evgeniy Yadlovskiy` in the MIT license.
- Do not add a roadmap or claim LitRes, background synchronization, multi-book import, or custom templates.

---

## File Structure

- Modify `README.md`: user-first product overview, installation, setup, usage, output, limitations, security, development, support, contribution, license, and disclaimer.
- Create `LICENSE`: canonical MIT License grant and copyright notice.
- Create `README-glossary-reference.md`: references for Reading Provider, Managed Book Note, Managed Section, and Yandex OAuth token.

### Task 1: Publish User And Contributor Documentation

**Files:**
- Modify: `README.md`
- Create: `LICENSE`
- Create: `README-glossary-reference.md`

**Interfaces:**
- Consumes: `manifest.json` version `0.1.0`, minimum Obsidian version `1.11.4`, author `Evgeniy Yadlovskiy`, and `isDesktopOnly: false`; `package.json` Node.js requirement `^20.19.0 || ^22.13.0 || >=24`; implemented Yandex Books settings, import wizard, and managed-note behavior.
- Produces: public GitHub documentation and a machine-recognizable root MIT license; no runtime interface changes.

- [ ] **Step 1: Record the stale-documentation baseline**

Run:

```bash
rg -n "LitRes|Yandex|Installation|Security|License" README.md
```

Expected: `README.md` identifies LitRes on line 5 and has no Yandex setup, installation, security, or license guidance.

- [ ] **Step 2: Replace `README.md` with the public user guide**

Write the sections in this order:

1. `# Book Highlights Importer`
2. Static badges for plugin version `0.1.0`, minimum Obsidian `1.11.4`, and MIT license.
3. One-sentence summary naming Obsidian and Yandex Books.
4. Exact non-rendering media comment:

```markdown
<!-- Demo GIF: docs/assets/book-highlights-importer-demo.gif -->
```

5. `## Features` with these verified points:
   - Search the authenticated Yandex Books library by title or author.
   - Browse books grouped as In progress, Finished, and Unread or unknown.
   - Import one book's highlights and comments through `Provider > Book > Destination`.
   - Choose a vault-relative folder and filename, with a configurable default folder.
   - Replace only the plugin-owned Managed Section on re-import while preserving user Markdown and unrelated properties.
   - Run on Obsidian desktop and mobile, version 1.11.4 or newer.
6. `## Installation` with two subsections:
   - `### Manual installation`: state that no prebuilt release exists yet, then instruct users to clone the repository, run `npm ci` and `npm run build`, create `<vault>/.obsidian/plugins/book-highlights-importer/`, copy `dist/main.js`, `dist/manifest.json`, and `dist/versions.json`, reload Obsidian, and enable Book Highlights Importer under Community plugins.
   - `### Community Plugins`: state that catalog installation is not available yet; after publication, users will be able to search for Book Highlights Importer in Obsidian's Community Plugins browser.
7. `## Setup` with numbered steps to open `Settings > Book Highlights Importer`, optionally set Default import folder, select Get Yandex OAuth token, authorize in the external browser, copy the `y0_...` value from the browser URL, paste and save it, and select Test connection. Add a warning that the token must be kept secret.
8. `## Usage` with numbered steps to run `Import Book Highlights`, select Yandex Books, search and choose one book, confirm folder and filename, and select Import. Explain the default `Author - Title.md` filename and that successful imports open the destination note.
9. `## Generated notes` with this exact non-rendering media comment:

```markdown
<!-- Generated note screenshot: docs/assets/generated-book-note.png -->
```

Describe `bh-provider`, `bh-book-id`, `bh-title`, `bh-authors`, and `bh-imported-at`; highlights as blockquotes; comments as `[!note] Comment` callouts; and the marker-delimited Managed Section. State that re-import replaces that section from the latest provider snapshot, removes no-longer-returned annotations, preserves other content/properties, and refuses to overwrite unmanaged, malformed, or differently identified notes.
10. `## Limitations` stating:
    - Yandex Books is the only supported provider.
    - Imports are explicit, one book at a time; there is no background sync.
    - There are no custom templates.
    - Importing the same book to another path can create another note.
    - Identical Yandex quote rows are preserved because stable quote identifiers are unavailable.
11. `## Security and privacy` stating that the token is stored through Obsidian Secret Storage, is not redisplayed, can be replaced or cleared, and must be treated as a password. Avoid broader privacy or token-scope guarantees.
12. `## Development` with Node.js `^20.19.0 || ^22.13.0 || >=24`, `npm ci`, `npm run build`, and `npm run check`.
13. `## Support and contributing` linking to `https://github.com/zhenya-yadlovskij/obsidian-book-highlights-importer/issues`, inviting bugs and feature requests, and asking contributors to discuss substantial changes before opening a pull request.
14. `## License` linking to `LICENSE` and identifying MIT.
15. `## Disclaimer` stating that the plugin is unofficial, is not affiliated with or endorsed by Yandex or Obsidian, and may be affected by Yandex service changes.

Bold the glossary terms Reading Provider, Managed Book Note, Managed Section, and Yandex OAuth token when they appear in prose. Do not bold headings, code, links, or frontmatter keys.

- [ ] **Step 3: Add the MIT license**

Create `LICENSE` with the canonical MIT License text from the SPDX MIT template and this notice:

```text
Copyright (c) 2026 Evgeniy Yadlovskiy
```

- [ ] **Step 4: Add the README glossary reference**

Create `README-glossary-reference.md` with:

```markdown
# Glossary Reference

| Term | Source Glossary | Context |
| --- | --- | --- |
| Reading Provider | `glossary/business.md` | Identifies Yandex Books as the external reading platform supported by the plugin. |
| Managed Book Note | `glossary/business.md` | Describes the complete destination note and duplicate-note limitation. |
| Managed Section | `glossary/technical.md` | Identifies the marker-delimited content replaced during re-import. |
| Yandex OAuth token | `glossary/technical.md` | Names the secret Yandex credential configured by the user. |
```

- [ ] **Step 5: Verify documentation content and links**

Run:

```bash
rg -n "LitRes|TO[D]O|TB[D]|github.com/.*/releases|available in Community Plugins" README.md LICENSE README-glossary-reference.md
```

Expected: no matches.

Run:

```bash
rg -n "Yandex Books|1\.11\.4|0\.1\.0|Secret Storage|npm run check|MIT|docs/assets/book-highlights-importer-demo\.gif|docs/assets/generated-book-note\.png" README.md
```

Expected: every required fact or media path has at least one match.

Run:

```bash
test "$(rg -c "^Copyright \(c\) 2026 Evgeniy Yadlovskiy$" LICENSE)" = "1"
```

Expected: exit status 0.

- [ ] **Step 6: Run the complete project checks**

Run:

```bash
npm run check
```

Expected: typecheck, lint, tests, build, and release verification all pass.

- [ ] **Step 7: Review and commit the documentation deliverable**

Run:

```bash
git diff --check
git status --short
git diff -- README.md LICENSE README-glossary-reference.md
```

Expected: only `README.md`, `LICENSE`, and `README-glossary-reference.md` contain uncommitted implementation changes, with no whitespace errors.

Commit:

```bash
git add README.md LICENSE README-glossary-reference.md
git commit -m "Document plugin setup and usage"
```
