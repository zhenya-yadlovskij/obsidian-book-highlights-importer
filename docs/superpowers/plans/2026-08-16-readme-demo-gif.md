# README Demo GIF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the README's non-rendering demo placeholder with the repository-hosted animated GIF so it renders on GitHub and in Obsidian's Community Plugins documentation view.

**Architecture:** Keep the GIF at `docs/assets/book-highlights-importer-demo.gif` and reference it from the existing top-of-README media location. Use the absolute raw GitHub URL so the README works when rendered outside the repository checkout.

**Tech Stack:** GitHub-flavored Markdown, Git, raw GitHub asset hosting.

## Global Constraints

- Modify only `README.md` during implementation.
- Keep the existing README content and section order unchanged.
- Use the exact repository asset `docs/assets/book-highlights-importer-demo.gif`.
- Use the `main` branch raw GitHub URL for the image source.
- Do not add an external image host or runtime code.

---

### Task 1: Embed The Demo GIF

**Files:**
- Modify: `README.md:9`
- Test: repository asset and README link verification commands

**Interfaces:**
- Consumes: `docs/assets/book-highlights-importer-demo.gif` from the `main` branch.
- Produces: a rendered Markdown image immediately after the README introduction.

- [ ] **Step 1: Replace the placeholder with the image reference**

Replace:

```markdown
<!-- Demo GIF: docs/assets/book-highlights-importer-demo.gif -->
```

with:

```markdown
![Book Highlights Importer demo](https://raw.githubusercontent.com/zhenya-yadlovskij/obsidian-book-highlights-importer/main/docs/assets/book-highlights-importer-demo.gif)
```

- [ ] **Step 2: Verify the local asset is an animated GIF**

Run:

```bash
file docs/assets/book-highlights-importer-demo.gif
```

Expected: output identifies a GIF image with animation frames.

- [ ] **Step 3: Verify the remote image URL responds**

Run:

```bash
curl --fail --silent --show-error --location --head https://raw.githubusercontent.com/zhenya-yadlovskij/obsidian-book-highlights-importer/main/docs/assets/book-highlights-importer-demo.gif
```

Expected: the command exits successfully and reports an HTTP success response.

- [ ] **Step 4: Check the README diff and whitespace**

Run:

```bash
git diff --check
```

Expected: only the placeholder line is replaced by the Markdown image line, with no whitespace errors.

- [ ] **Step 5: Commit the README update**

Run:

```bash
git add README.md
git commit -m "docs: embed plugin demo GIF"
```
