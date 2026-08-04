import { describe, expect, it, vi } from "vitest";

import {
  createObsidianCredentialStore,
  YANDEX_TOKEN_SECRET_ID,
} from "../../src/obsidian/credential-store";

describe("Obsidian credential store", () => {
  it("reads a configured provider from its exact lowercase secret ID", () => {
    const getSecret = vi.fn().mockReturnValue("  oauth-token  ");
    const store = createObsidianCredentialStore({ getSecret, setSecret: vi.fn() });

    expect(store.get("yandex-books")).toBe("oauth-token");
    expect(getSecret).toHaveBeenCalledWith(YANDEX_TOKEN_SECRET_ID);
    expect(YANDEX_TOKEN_SECRET_ID).toBe("book-highlights-importer-yandex-books-token");
  });

  it.each([null, "", "   "])("treats a missing or blank secret as unconfigured: %j", (secret) => {
    const store = createObsidianCredentialStore({
      getSecret: vi.fn().mockReturnValue(secret),
      setSecret: vi.fn(),
    });

    expect(store.get("yandex-books")).toBeNull();
  });

  it("saves replacements without surrounding whitespace", () => {
    const setSecret = vi.fn();
    const store = createObsidianCredentialStore({ getSecret: vi.fn(), setSecret });

    store.set("yandex-books", " first-token ");
    store.set("yandex-books", "replacement-token");

    expect(setSecret.mock.calls).toEqual([
      [YANDEX_TOKEN_SECRET_ID, "first-token"],
      [YANDEX_TOKEN_SECRET_ID, "replacement-token"],
    ]);
  });

  it("blank-clears credentials because SecretStorage has no delete operation", () => {
    const setSecret = vi.fn();
    const store = createObsidianCredentialStore({ getSecret: vi.fn(), setSecret });

    store.set("yandex-books", "  ");
    store.clear("yandex-books");

    expect(setSecret.mock.calls).toEqual([
      [YANDEX_TOKEN_SECRET_ID, ""],
      [YANDEX_TOKEN_SECRET_ID, ""],
    ]);
  });

  it("rejects provider IDs without an explicit secret registration", () => {
    const getSecret = vi.fn();
    const setSecret = vi.fn();
    const store = createObsidianCredentialStore({ getSecret, setSecret });

    expect(() => store.get("unknown-provider")).toThrow("No credential secret is registered for provider unknown-provider");
    expect(() => {
      store.set("unknown-provider", "credential");
    }).toThrow();
    expect(() => {
      store.clear("unknown-provider");
    }).toThrow();
    expect(getSecret).not.toHaveBeenCalled();
    expect(setSecret).not.toHaveBeenCalled();
  });
});
