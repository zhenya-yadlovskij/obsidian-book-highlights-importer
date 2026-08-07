# Book Highlights Importer README Design

## Goal

Replace the stale project README with an English, user-first guide that is ready for the plugin's public launch. The guide must accurately document the implemented Yandex Books workflow, establish appropriate security and product expectations, and retain concise information for contributors.

## Audience And Positioning

The primary audience is an Obsidian user who wants to import highlights and comments from Yandex Books. Contributors are a secondary audience.

The opening will contain:

- The plugin name and a one-sentence value proposition that identifies Yandex Books as the supported **Reading Provider**.
- Compatibility and version badges based on `manifest.json`.
- A placeholder for an end-to-end demo at `docs/assets/book-highlights-importer-demo.gif`.
- A short list of verified features.

The README will not claim support for LitRes, automatic synchronization, or other unimplemented functionality. It will not include a speculative roadmap.

## User Journey

The main documentation path will follow the order in which a new user encounters the plugin:

1. Installation
2. Yandex OAuth token setup
3. Importing a book
4. Understanding the generated note

Manual installation will be the current installation method. The README will reserve clearly labeled future instructions for installation through Obsidian Community Plugins without implying that the plugin is already published or that a GitHub release currently exists.

Token setup will mirror the implemented settings flow: open Yandex authorization, copy the `y0_...` value from the resulting browser URL, save it in plugin settings, and test the connection. Import instructions will mirror the actual `Provider > Book > Destination` wizard and explain book search, the default destination, and generated filenames.

The generated-note section will include a placeholder at `docs/assets/generated-book-note.png`. It will describe imported highlights as blockquotes, comments as callouts, the plugin-owned properties, and re-import behavior without exposing unnecessary implementation detail.

## Features And Boundaries

The feature list will cover only verified behavior:

- Searchable Yandex Books library grouped by reading status.
- Explicit, single-book import of highlights and comments.
- Configurable default folder and editable destination filename.
- Safe replacement of the plugin-owned **Managed Section** during re-import.
- Preservation of user-authored Markdown and unrelated note properties.
- Obsidian desktop and mobile support with a minimum app version of 1.11.4.

The limitations section will state that the plugin does not provide background synchronization, multi-book import, custom templates, or other providers. It will explain that identical Yandex rows are retained because Yandex does not provide stable quote identifiers. It will also state that importing the same book to a different path can create another **Managed Book Note**.

Destination conflicts will be explained as a safety feature: unmanaged files, malformed managed markers, and notes associated with a different provider or book are not overwritten.

## Security And Privacy

The README will include a dedicated section that:

- Tells users to treat the **Yandex OAuth token** as a password.
- States that the token is saved using Obsidian Secret Storage and is not redisplayed by the plugin.
- Explains that the token can be replaced or cleared in settings.
- Avoids unsupported guarantees about Yandex, Obsidian, network handling, or account-wide token scope.

A concise footer disclaimer will state that the project is unofficial and is not affiliated with or endorsed by Yandex or Obsidian. It will also warn that changes to Yandex services may affect importing.

## Project Information

The contributor section will be brief and include:

- Supported Node.js versions from `package.json`.
- `npm ci` for dependency installation.
- `npm run build` for a production build.
- `npm run check` for the complete local verification suite.
- An Issues-first policy that asks contributors to discuss substantial changes before opening a pull request.

Bug reports and feature requests will link to this repository's GitHub Issues page for use after the repository becomes public.

The project will use the MIT License. A standard `LICENSE` file will contain `Copyright (c) 2026 Evgeniy Yadlovskiy`.

## Media Placeholders

The README will reference these future assets:

- `docs/assets/book-highlights-importer-demo.gif`
- `docs/assets/generated-book-note.png`

Until those assets are supplied, each reference will be represented by an explicit Markdown comment rather than a broken image. No fake media files will be created.

## Terminology

Existing repository terminology will be used consistently. In particular, the README will distinguish a **Reading Provider**, a complete **Managed Book Note**, its replaceable **Managed Section**, and the **Yandex OAuth token**. Generic user-facing wording will be preferred where a technical glossary term does not improve clarity.

## Verification

Before completion:

1. Cross-check user-visible claims against the implementation and current OpenSpec artifacts.
2. Check that repository links and referenced paths are correct or explicitly marked as future placeholders.
3. Ensure that the README does not claim Community Plugins publication or an existing GitHub release.
4. Run the project's relevant checks and report their exact results.
5. Review the final diff for accidental changes outside the README, license, and required glossary references.
