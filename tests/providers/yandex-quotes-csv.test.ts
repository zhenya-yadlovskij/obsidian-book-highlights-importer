import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  parseYandexQuoteCreatedAt,
  parseYandexQuoteCsv,
} from "../../src/providers/yandex-quotes-csv";

const fixture = readFileSync(
  new URL("../fixtures/yandex/book-quotes-export.csv", import.meta.url),
  "utf8",
);

describe("Yandex quote CSV parser", () => {
  it("parses the representative export including quoted values and newlines", () => {
    const rows = parseYandexQuoteCsv(fixture);

    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      book_title: "Книга-образец",
      book_authors: "Автор Пример",
      content: "Цитата с запятой, внутри",
      comment: 'Комментарий с "кавычками"',
      color: "blue",
      created_at: "2025-01-01 10:00:00 +0300",
    });
    expect(rows[1]?.comment).toBe("");
    expect(rows[2]?.content).toBe("First line\nSecond line");
    expect(Object.isFrozen(rows)).toBe(true);
    expect(Object.isFrozen(rows[0])).toBe(true);
  });

  it("accepts CRLF records, a UTF-8 BOM, and additive columns", () => {
    const source = [
      "\uFEFFbook_title,book_authors,content,comment,color,created_at,export_version",
      '"Book","Author","Text","","blue","2025-01-01 00:00:00 +0000","v1"',
      "",
    ].join("\r\n");

    expect(parseYandexQuoteCsv(source)).toEqual([{
      book_title: "Book",
      book_authors: "Author",
      content: "Text",
      comment: "",
      color: "blue",
      created_at: "2025-01-01 00:00:00 +0000",
    }]);
  });

  it.each([
    ["empty header", ""],
    ["malformed header", "book_title,book_authors\nvalue,value"],
    ["missing required header", "book_title,book_authors,content,comment,color\nvalue,value,value,value,value"],
    ["duplicate required header", "book_title,book_title,book_authors,content,comment,color,created_at\nvalue,value,value,value,value,value,value"],
  ])("rejects a %s", (_name, source) => {
    expect(() => parseYandexQuoteCsv(source)).toThrow();
  });

  it.each([
    ["an invalid quote transition", "book_title,book_authors,content,comment,color,created_at\nBook,Author,bad\"quote,,blue,date"],
    ["an unterminated quote after a valid record", "book_title,book_authors,content,comment,color,created_at\nBook,Author,valid,,blue,date\nBook,Author,\"unterminated,,blue,date"],
    ["a field-count mismatch", "book_title,book_authors,content,comment,color,created_at\nBook,Author,Text,,blue,date,extra\nBook,Author,Text"],
  ])("rejects %s without returning a valid prefix", (_name, source) => {
    expect(() => parseYandexQuoteCsv(source)).toThrow();
  });
});

describe("Yandex quote creation timestamp parser", () => {
  it("converts explicit offsets to epoch seconds", () => {
    expect(parseYandexQuoteCreatedAt("2025-01-01 10:00:00 +0300")).toBe(
      Date.UTC(2025, 0, 1, 7, 0, 0) / 1000,
    );
    expect(parseYandexQuoteCreatedAt("2025-01-01 07:00:00 +0000")).toBe(
      parseYandexQuoteCreatedAt("2025-01-01 10:00:00 +0300"),
    );
  });

  it.each([
    "",
    "2025-02-29 10:00:00 +0000",
    "2025-01-01 24:00:00 +0000",
    "2025-01-01 10:00:00 +2460",
    "2025-01-01T10:00:00+0000",
  ])("returns undefined for invalid or blank value %j", (value) => {
    expect(parseYandexQuoteCreatedAt(value)).toBeUndefined();
  });
});
