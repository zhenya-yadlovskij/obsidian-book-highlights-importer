import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { client, output } = vi.hoisted(() => ({
  client: {
    getProfile: vi.fn(),
    getMyLibrary: vi.fn(),
    getUserQuotes: vi.fn(),
  },
  output: [] as string[],
}));

vi.mock("yandex-book-api-ts", () => ({
  YandexBookClient: function YandexBookClient(credential: string): typeof client {
    if (credential === "") throw new Error("Expected a credential");
    return client;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  output.length = 0;
  process.env.YANDEX_BOOKS_OAUTH_TOKEN = "test-credential";
  process.exitCode = undefined;
  client.getProfile.mockResolvedValue({ login: "reader-login" });
  client.getMyLibrary.mockResolvedValue([]);
  client.getUserQuotes.mockResolvedValue([]);
  vi.spyOn(console, "log").mockImplementation((value: string) => {
    output.push(value);
  });
});

afterEach(() => {
  delete process.env.YANDEX_BOOKS_OAUTH_TOKEN;
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

it("uses profile login for the sanitized quote smoke test", async () => {
  // @ts-expect-error The executable JavaScript smoke entry has no declaration file.
  await import("../../scripts/yandex-smoke.mjs");

  expect(client.getUserQuotes).toHaveBeenCalledWith("reader-login", 1, 100);
  expect(output).toContain(JSON.stringify({ name: "getProfile", ok: true, hasIdentity: true }));
  expect(process.exitCode).toBeUndefined();
});

it("exits unsuccessfully when the library call fails", async () => {
  client.getMyLibrary.mockRejectedValue(Object.assign(new Error("unsafe"), { status: 503 }));

  // @ts-expect-error The executable JavaScript smoke entry has no declaration file.
  await import("../../scripts/yandex-smoke.mjs");

  expect(process.exitCode).toBe(1);
  expect(client.getUserQuotes).toHaveBeenCalledWith("reader-login", 1, 100);
});

it("exits unsuccessfully when the quote call fails", async () => {
  client.getUserQuotes.mockRejectedValue(Object.assign(new Error("unsafe"), { status: 503 }));

  // @ts-expect-error The executable JavaScript smoke entry has no declaration file.
  await import("../../scripts/yandex-smoke.mjs");

  expect(process.exitCode).toBe(1);
});
