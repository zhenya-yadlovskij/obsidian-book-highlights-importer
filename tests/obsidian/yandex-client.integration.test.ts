import { expect, it, vi } from "vitest";
import type { RequestUrlParam } from "obsidian";

import { createObsidianYandexClient } from "../../src/obsidian/yandex-client";

const jsonResponse = (value: unknown): {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly arrayBuffer: ArrayBuffer;
  readonly json: unknown;
  readonly text: string;
} => {
  const text = JSON.stringify(value);
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    arrayBuffer: new TextEncoder().encode(text).buffer,
    json: value,
    text,
  };
};

const textResponse = (text: string): {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly arrayBuffer: ArrayBuffer;
  readonly json: unknown;
  readonly text: string;
} => ({
  status: 200,
  headers: { "content-type": "text/csv" },
  arrayBuffer: new TextEncoder().encode(text).buffer,
  json: undefined,
  text,
});

it("runs profile, library, and selected-book CSV export through the injected Obsidian transport", async () => {
  const exportText = "book_title,book_authors,content,comment,color,created_at\n";
  const requestUrl = vi.fn((request: RequestUrlParam | string) => {
    if (typeof request === "string") throw new Error(`Unexpected URL: ${request}`);
    const { url } = request;
    if (url.endsWith("/profile")) return Promise.resolve(jsonResponse({ user: { login: "reader-login" } }));
    if (url.startsWith("https://api.bookmate.yandex.net/api/v5/profile/library_cards?")) {
      return Promise.resolve(jsonResponse({ library_cards: [] }));
    }
    if (url === "https://api.bookmate.yandex.net/api/v5/profile/books/book-1/quotes_export?format=csv") {
      return Promise.resolve(textResponse(exportText));
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  const client = createObsidianYandexClient("test-token", requestUrl);

  await expect(client.getProfile()).resolves.toMatchObject({ login: "reader-login" });
  await expect(client.getMyLibrary(100, 0)).resolves.toEqual([]);
  await expect(client.exportBookQuotes("book-1", "csv")).resolves.toBe(exportText);

  expect(requestUrl).toHaveBeenCalledTimes(3);
  expect(requestUrl.mock.calls.map(([request]) => typeof request === "string" ? request : request.url)).toEqual([
    "https://api.bookmate.yandex.net/api/v5/profile",
    "https://api.bookmate.yandex.net/api/v5/profile/library_cards?limit=100&offset=0",
    "https://api.bookmate.yandex.net/api/v5/profile/books/book-1/quotes_export?format=csv",
  ]);
  expect(requestUrl.mock.calls.every(([request]) =>
    typeof request !== "string" && request.headers?.["auth-token"] === "test-token",
  )).toBe(true);
});
