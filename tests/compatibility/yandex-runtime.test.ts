import { ApiError } from "yandex-book-api-ts";
import { describe, expect, it, vi } from "vitest";

import {
  createYandexRuntimeHarness,
  YANDEX_TOKEN_SECRET_ID,
  type YandexRuntimeClient,
} from "../../src/compatibility/yandex-runtime";

const profile = {
  uuid: undefined,
  id: 42,
  login: "reader-login",
};

const createClient = (): YandexRuntimeClient => ({
  getProfile: vi.fn().mockResolvedValue(profile),
  getMyLibrary: vi.fn().mockResolvedValue([
    { state: "reading", readingProgress: 0.25, book: { uuid: "book-1" } },
    { state: "finished", readingProgress: 1, book: { uuid: "book-2" } },
  ]),
  exportBookQuotes: vi.fn().mockResolvedValue([
    "book_title,book_authors,content,comment,color,created_at",
    '"Synthetic","Author","Highlight","",blue,"2025-01-01 00:00:00 +0000"',
    '"Synthetic","Author","","Comment",yellow,"2025-01-01 00:00:00 +0000"',
    "",
  ].join("\n")),
});

describe("Yandex runtime compatibility harness", () => {
  it("stores, replaces, and blank-clears the token through SecretStorage", () => {
    const secrets = new Map<string, string>();
    const storage = {
      getSecret: (id: string): string | null => secrets.get(id) ?? null,
      setSecret: (id: string, value: string): void => {
        secrets.set(id, value);
      },
    };
    const harness = createYandexRuntimeHarness(storage, () => createClient());

    expect(harness.isConfigured()).toBe(false);
    harness.saveCredential(" first-token ");
    expect(secrets.get(YANDEX_TOKEN_SECRET_ID)).toBe("first-token");
    expect(harness.isConfigured()).toBe(true);
    harness.saveCredential("replacement-token");
    expect(secrets.get(YANDEX_TOKEN_SECRET_ID)).toBe("replacement-token");
    harness.clearCredential();
    expect(secrets.get(YANDEX_TOKEN_SECRET_ID)).toBe("");
    expect(harness.isConfigured()).toBe(false);
  });

  it("selects a library book and returns sanitized export evidence", async () => {
    const client = createClient();
    const harness = createYandexRuntimeHarness(
      { getSecret: () => "secret", setSecret: vi.fn() },
      () => client,
    );

    await expect(harness.run()).resolves.toEqual({
      ok: true,
      library: {
        count: 2,
        states: [
          { state: "finished", count: 1, progressMin: 1, progressMax: 1 },
          { state: "reading", count: 1, progressMin: 0.25, progressMax: 0.25 },
        ],
      },
      quotes: {
        count: 2,
        importableCount: 2,
        structuralStatus: "valid",
      },
    });
    expect(client.exportBookQuotes).toHaveBeenCalledWith("book-1", "csv");
  });

  it("stops before constructing a client when the credential is blank", async () => {
    const clientFactory = vi.fn(() => createClient());
    const harness = createYandexRuntimeHarness(
      { getSecret: () => "  ", setSecret: vi.fn() },
      clientFactory,
    );

    await expect(harness.run()).resolves.toEqual({ ok: false, stage: "credential", errorType: "MissingCredential" });
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("rejects a profile without login before library or quote calls", async () => {
    const client = createClient();
    vi.mocked(client.getProfile).mockResolvedValue({});
    const harness = createYandexRuntimeHarness(
      { getSecret: () => "secret", setSecret: vi.fn() },
      () => client,
    );

    await expect(harness.run()).resolves.toEqual({ ok: false, stage: "profile", errorType: "MissingLogin" });
    expect(client.getMyLibrary).not.toHaveBeenCalled();
    expect(client.exportBookQuotes).not.toHaveBeenCalled();
  });

  it("fails safely when no library card has a usable book ID", async () => {
    const client = createClient();
    vi.mocked(client.getMyLibrary).mockResolvedValue([
      { state: "reading", book: { uuid: "  " } },
      { state: "finished", book: {} },
    ]);
    const harness = createYandexRuntimeHarness(
      { getSecret: () => "secret", setSecret: vi.fn() },
      () => client,
    );

    await expect(harness.run()).resolves.toEqual({ ok: false, stage: "library", errorType: "MissingBookId" });
    expect(client.exportBookQuotes).not.toHaveBeenCalled();
  });

  it("fails safely when the selected-book export is malformed", async () => {
    const client = createClient();
    vi.mocked(client.exportBookQuotes).mockResolvedValue("book_title,content\nSynthetic,valid");
    const harness = createYandexRuntimeHarness(
      { getSecret: () => "secret", setSecret: vi.fn() },
      () => client,
    );

    await expect(harness.run()).resolves.toEqual({ ok: false, stage: "quotes", errorType: "InvalidQuoteExport" });
  });

  it("reports only the failure type and status", async () => {
    const client = createClient();
    vi.mocked(client.getMyLibrary).mockRejectedValue(Object.assign(new Error("unsafe provider details"), { status: 503 }));
    const harness = createYandexRuntimeHarness(
      { getSecret: () => "secret", setSecret: vi.fn() },
      () => client,
    );

    const result = await harness.run();

    expect(result).toEqual({ ok: false, stage: "library", errorType: "Error", status: 503 });
    expect(JSON.stringify(result)).not.toContain("unsafe provider details");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("sanitizes client-construction failures", async () => {
    const harness = createYandexRuntimeHarness(
      { getSecret: () => "secret", setSecret: vi.fn() },
      () => {
        throw Object.assign(new Error("unsafe constructor details"), { status: 500 });
      },
    );

    const result = await harness.run();

    expect(result).toEqual({ ok: false, stage: "client", errorType: "Error", status: 500 });
    expect(JSON.stringify(result)).not.toContain("unsafe constructor details");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("classifies minified package transport errors without exposing details", async () => {
    const MinifiedApiError = class w extends ApiError {};
    const client = createClient();
    vi.mocked(client.getProfile).mockRejectedValue(new MinifiedApiError(
      "unsafe provider message",
      { details: "Refused to set unsafe header User-Agent" },
    ));
    const harness = createYandexRuntimeHarness(
      { getSecret: () => "secret", setSecret: vi.fn() },
      () => client,
    );

    const result = await harness.run();

    expect(result).toEqual({
      ok: false,
      stage: "profile",
      errorType: "ApiError",
      reason: "forbidden-header",
    });
    expect(JSON.stringify(result)).not.toContain("User-Agent");
    expect(JSON.stringify(result)).not.toContain("unsafe provider message");
  });
});
