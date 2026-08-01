import { ApiError, UnauthorizedError } from "yandex-book-api-ts";
import { describe, expect, it } from "vitest";
import { createYandexBooksProvider, type YandexClient } from "../../src/providers/yandex";

const client = (overrides: Partial<YandexClient> = {}): YandexClient => ({
  getProfile: async () => undefined,
  getMyLibrary: async () => [],
  getUserQuotes: async () => [],
  ...overrides,
});

describe("Yandex Books provider credential validation", () => {
  it("accepts a profile with a non-blank login", async () => {
    const provider = createYandexBooksProvider(() => client({
      getProfile: async () => ({ login: "reader" }),
    }));

    await expect(provider.testCredential("secret-token")).resolves.toEqual({ ok: true, value: undefined });
  });

  it.each([
    [new UnauthorizedError("unsafe token message"), "authentication"],
    [new TypeError("offline"), "provider-unavailable"],
    [new ApiError("rejected", { status: 400 }), "incomplete-data"],
    [undefined, "incomplete-data"],
    [{ login: "  " }, "incomplete-data"],
    [new Error("unknown provider detail"), "provider-unavailable"],
  ] as const)("maps credential failure safely", async (outcome, category) => {
    const provider = createYandexBooksProvider(() => client({
      getProfile: async () => {
        if (outcome instanceof Error) throw outcome;
        return outcome;
      },
    }));

    const result = await provider.testCredential("secret-token");

    expect(result).toEqual({ ok: false, error: { category, providerId: "yandex-books" } });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
});
