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

it("runs profile, library, and quotes through the injected Obsidian transport", async () => {
  const requestUrl = vi.fn((request: RequestUrlParam | string) => {
    if (typeof request === "string") throw new Error(`Unexpected URL: ${request}`);
    const { url } = request;
    if (url.endsWith("/profile")) return Promise.resolve(jsonResponse({ user: { login: "reader-login" } }));
    if (url.startsWith("https://api.bookmate.yandex.net/api/v5/profile/library_cards?")) {
      return Promise.resolve(jsonResponse({ library_cards: [] }));
    }
    if (url.startsWith("https://api.bookmate.yandex.net/api/v5/users/reader-login/quotes?")) {
      return Promise.resolve(jsonResponse({ quotes: [] }));
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  const client = createObsidianYandexClient("test-token", requestUrl);

  await expect(client.getProfile()).resolves.toMatchObject({ login: "reader-login" });
  await expect(client.getMyLibrary(100, 0)).resolves.toEqual([]);
  await expect(client.getUserQuotes("reader-login", 1, 100)).resolves.toEqual([]);

  expect(requestUrl).toHaveBeenCalledTimes(3);
  expect(requestUrl.mock.calls.map(([request]) => typeof request === "string" ? request : request.url)).toEqual([
    "https://api.bookmate.yandex.net/api/v5/profile",
    "https://api.bookmate.yandex.net/api/v5/profile/library_cards?limit=100&offset=0",
    "https://api.bookmate.yandex.net/api/v5/users/reader-login/quotes?page=1&per_page=100",
  ]);
  expect(requestUrl.mock.calls.every(([request]) =>
    typeof request !== "string" && request.headers?.["auth-token"] === "test-token",
  )).toBe(true);
});
