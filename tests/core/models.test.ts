import { describe, expect, it } from "vitest";
import {
  createBookAnnotation,
  createImportSnapshot,
  createProviderBook,
} from "../../src/core/models";

describe("core models", () => {
  it("creates an immutable provider book with a normalized status", () => {
    const authors = ["Frank Herbert"];
    const book = createProviderBook({
      providerId: "yandex-books",
      bookId: "dune",
      title: "Dune",
      authors,
      status: "reading",
      progress: 0.4,
    });

    authors.push("Someone Else");

    expect(book).toEqual({
      providerId: "yandex-books",
      bookId: "dune",
      title: "Dune",
      authors: ["Frank Herbert"],
      status: "in-progress",
      progress: 0.4,
    });
    expect(Object.isFrozen(book)).toBe(true);
    expect(Object.isFrozen(book.authors)).toBe(true);
  });

  it("creates immutable annotations with stable input indexes", () => {
    const sectionPath = ["Part I", "Chapter 1"];
    const annotation = createBookAnnotation({
      text: "Fear is the mind-killer.",
      sectionPath,
      sectionOrder: 2,
      location: 12,
      inputIndex: 7,
    });

    sectionPath.push("Changed");

    expect(annotation.sectionPath).toEqual(["Part I", "Chapter 1"]);
    expect(annotation.inputIndex).toBe(7);
    expect(Object.isFrozen(annotation)).toBe(true);
    expect(Object.isFrozen(annotation.sectionPath)).toBe(true);
  });

  it("creates an immutable snapshot containing one selected book", () => {
    const book = createProviderBook({
      providerId: "provider",
      bookId: "book",
      title: "Title",
      authors: [],
      status: "unknown",
    });
    const annotation = createBookAnnotation({ text: "A note", inputIndex: 0 });
    const snapshot = createImportSnapshot({ book, annotations: [annotation] });

    expect(snapshot.book).toEqual(book);
    expect(snapshot.annotations).toEqual([annotation]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.annotations)).toBe(true);
  });

  it("deeply clones and freezes nested snapshot data", () => {
    const authors = ["Author"];
    const sectionPath = ["Chapter 1"];
    const sourceBook = {
      providerId: "provider",
      bookId: "book",
      title: "Title",
      authors,
      status: "finished",
    } as const;
    const sourceAnnotation = {
      text: "A note",
      sectionPath,
      inputIndex: 0,
    } as const;
    const snapshot = createImportSnapshot({
      book: sourceBook,
      annotations: [sourceAnnotation],
    });

    authors.push("Changed");
    sectionPath.push("Changed");

    expect(snapshot.book.authors).toEqual(["Author"]);
    expect(snapshot.annotations[0]?.sectionPath).toEqual(["Chapter 1"]);
    expect(Object.isFrozen(snapshot.book)).toBe(true);
    expect(Object.isFrozen(snapshot.book.authors)).toBe(true);
    expect(Object.isFrozen(snapshot.annotations[0])).toBe(true);
    expect(Object.isFrozen(snapshot.annotations[0]?.sectionPath)).toBe(true);
  });
});
