# README Demo GIF Design

## Goal

Display the repository's animated plugin demo at the top of the public README and in the README view shown by Obsidian's Community Plugins browser.

## Context

The GIF is stored at `docs/assets/book-highlights-importer-demo.gif` on the repository's `main` branch. The README currently contains a non-rendering HTML comment at the intended location. Obsidian's community-plugin detail view retrieves the repository README, so the image reference must remain accessible outside a local checkout.

## Decision

Replace the placeholder comment with a Markdown image whose source is the repository's absolute raw GitHub URL:

```markdown
![Book Highlights Importer demo](https://raw.githubusercontent.com/zhenya-yadlovskij/obsidian-book-highlights-importer/main/docs/assets/book-highlights-importer-demo.gif)
```

The image will remain immediately after the introductory sentence and before the Features section. No other README content or plugin behavior will change.

An absolute repository URL is preferred over a relative path because it works when GitHub renders the README and when Obsidian fetches the README independently. An external image host is unnecessary and would add a maintenance dependency.

## Verification

- Confirm the GIF exists and is recognized as an animated GIF.
- Confirm the raw GitHub URL responds successfully.
- Review the final diff to ensure only the README placeholder is replaced.
- Run `git diff --check`.
