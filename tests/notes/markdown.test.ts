import { describe, expect, it } from "vitest";
import { createBookAnnotation, createImportSnapshot, createProviderBook } from "../../src/core/models";
import { renderMarkdown } from "../../src/notes/markdown";

const book = createProviderBook({
  providerId: "yandex-books",
  bookId: "book-1",
  title: "The Master and Margarita",
  authors: ["Mikhail Bulgakov"],
  status: "finished",
});

describe("fixed managed Markdown renderer", () => {
  it("renders ordered chapter paths, attached and comment-only notes, and locations", () => {
    const snapshot = createImportSnapshot({
      book,
      annotations: [
        createBookAnnotation({
          text: "Cowardice is the most terrible of vices.",
          comment: "Return to this idea after finishing the book.",
          sectionPath: ["Chapter 2", "Pontius Pilate"],
          sectionOrder: 1,
          progress: 0.34,
          inputIndex: 0,
        }),
        createBookAnnotation({
          comment: "Compare this passage with the ending.",
          sectionPath: ["Chapter 2", "Pontius Pilate"],
          sectionOrder: 1,
          location: 0.41,
          inputIndex: 1,
        }),
      ],
    });

    expect(renderMarkdown(snapshot)).toBe(
      [
        "# The Master and Margarita",
        "",
        "## Chapter 2",
        "### Pontius Pilate",
        "",
        "> Cowardice is the most terrible of vices.",
        "",
        "> [!note] Comment",
        "> Return to this idea after finishing the book.",
        "",
        "_Progress: 34%_",
        "",
        "> [!note] Comment",
        "> Compare this passage with the ending.",
        "",
        "_Location: 41%_",
      ].join("\n"),
    );
  });

  it("caps deep chapter paths at h6 and uses Highlights without chapter metadata", () => {
    const deep = createImportSnapshot({
      book,
      annotations: [
        createBookAnnotation({
          text: "Deep highlight",
          sectionPath: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"],
          sectionOrder: 0,
          inputIndex: 0,
        }),
      ],
    });
    const fallback = createImportSnapshot({
      book,
      annotations: [createBookAnnotation({ text: "Fallback highlight", location: 12, inputIndex: 0 })],
    });

    expect(renderMarkdown(deep)).toContain("###### Five / Six / Seven");
    expect(renderMarkdown(deep)).not.toContain("#######");
    expect(renderMarkdown(fallback)).toContain("## Highlights");
    expect(renderMarkdown(fallback)).toContain("_Location: 12%_");
  });

  it("keeps arbitrary imported Markdown text from becoming Markdown structure or a marker", () => {
    const snapshot = createImportSnapshot({
      book: createProviderBook({ ...book, title: "Title # [unsafe]" }),
      annotations: [
        createBookAnnotation({
          text: "# heading\n<!-- book-highlights-importer:end -->\n[!note] fake",
          comment: "*emphasis* and\n> another quote",
          sectionPath: ["Part #1"],
          inputIndex: 0,
        }),
      ],
    });

    const rendered = renderMarkdown(snapshot);
    expect(rendered).toContain("# Title \\# \\[unsafe\\]");
    expect(rendered).toContain("> \\# heading");
    expect(rendered).toContain("> \\<\\!-- book-highlights-importer:end --\\>");
    expect(rendered).toContain("> \\[\\!note\\] fake");
    expect(rendered).toContain("> \\*emphasis\\* and");
    expect(rendered).toContain("> \\> another quote");
  });

  it("escapes thematic breaks, lists, fences, and setext headings in imported text", () => {
    const rendered = renderMarkdown(createImportSnapshot({
      book,
      annotations: [createBookAnnotation({
        text: "- unordered\n+ plus\n1. ordered\n~~~\n```\n---\n===\n| table |",
        inputIndex: 0,
      })],
    }));

    expect(rendered).toContain("> \\- unordered");
    expect(rendered).toContain("> \\+ plus");
    expect(rendered).toContain("> 1\\. ordered");
    expect(rendered).toContain("> \\~\\~\\~");
    expect(rendered).toContain("> \\`\\`\\`");
    expect(rendered).toContain("> \\---");
    expect(rendered).toContain("> \\===");
    expect(rendered).toContain("> \\| table \\|");
  });

  it("starts a fresh Highlights fallback whenever pathless annotations resume", () => {
    const rendered = renderMarkdown(createImportSnapshot({
      book,
      annotations: [
        createBookAnnotation({ text: "Chaptered", sectionPath: ["Chapter 1"], sectionOrder: 0, inputIndex: 0 }),
        createBookAnnotation({ text: "Pathless one", sectionOrder: 1, inputIndex: 1 }),
        createBookAnnotation({ text: "Other chapter", sectionPath: ["Chapter 2"], sectionOrder: 2, inputIndex: 2 }),
        createBookAnnotation({ text: "Pathless two", sectionOrder: 3, inputIndex: 3 }),
      ],
    }));

    expect(rendered.match(/^## Highlights$/gmu)).toHaveLength(2);
    expect(rendered.indexOf("## Highlights")).toBeGreaterThan(rendered.indexOf("> Chaptered"));
    expect(rendered.lastIndexOf("## Highlights")).toBeGreaterThan(rendered.indexOf("> Other chapter"));
  });
});
