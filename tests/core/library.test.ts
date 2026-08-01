import { describe, expect, it } from "vitest";
import { createProviderBook, type ProviderBook } from "../../src/core/models";
import { groupBooks, searchBooks } from "../../src/core/library";

const book = (bookId: string, status: string, title: string, authors: string[]): ProviderBook =>
  createProviderBook({
    providerId: "provider",
    bookId,
    title,
    authors,
    status,
  });

describe("library grouping and search", () => {
  it("groups every book in the required order", () => {
    const groups = groupBooks([
      book("unknown", "mystery", "Unknown", ["A"]),
      book("finished", "finished", "Finished", ["B"]),
      book("reading", "reading", "Reading", ["C"]),
      book("unread", "unread", "Unread", ["D"]),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      "in-progress",
      "finished",
      "unread-or-unknown",
    ]);
    expect(groups.flatMap((group) => group.books).map((item) => item.bookId)).toEqual([
      "reading",
      "finished",
      "unknown",
      "unread",
    ]);
  });

  it("searches title and author while preserving group order", () => {
    const groups = groupBooks([
      book("a", "reading", "Dune", ["Frank Herbert"]),
      book("b", "finished", "Foundation", ["Isaac Asimov"]),
      book("c", "unread", "Children of Dune", ["Someone"]),
    ]);

    expect(searchBooks(groups, "  HERBERT ").flatMap((group) => group.books.map((item) => item.bookId))).toEqual([
      "a",
    ]);
    expect(searchBooks(groups, "dune").map((group) => group.key)).toEqual([
      "in-progress",
      "unread-or-unknown",
    ]);
  });
});
