import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { client, output } = vi.hoisted(() => ({
  client: {
    getProfile: vi.fn(),
    getMyLibrary: vi.fn(),
    exportBookQuotes: vi.fn(),
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
  client.getMyLibrary.mockResolvedValue([{ book: { uuid: "book-1" } }]);
  client.exportBookQuotes.mockResolvedValue("synthetic,csv,response");
  vi.spyOn(console, "log").mockImplementation((value: string) => {
    output.push(value);
  });
});

afterEach(() => {
  delete process.env.YANDEX_BOOKS_OAUTH_TOKEN;
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

it("uses a library book ID for the sanitized quote smoke test", async () => {
  // @ts-expect-error The executable JavaScript smoke entry has no declaration file.
  await import("../../scripts/yandex-smoke.mjs");

  expect(client.exportBookQuotes).toHaveBeenCalledWith("book-1", "csv");
  expect(output).toContain(JSON.stringify({ name: "getProfile", ok: true, hasIdentity: true }));
  expect(process.exitCode).toBeUndefined();
});

it("exits unsuccessfully when the library call fails", async () => {
  client.getMyLibrary.mockRejectedValue(Object.assign(new Error("unsafe"), { status: 503 }));

  // @ts-expect-error The executable JavaScript smoke entry has no declaration file.
  await import("../../scripts/yandex-smoke.mjs");

  expect(process.exitCode).toBe(1);
  expect(client.exportBookQuotes).not.toHaveBeenCalled();
});

it("exits unsuccessfully when the export call fails", async () => {
  client.exportBookQuotes.mockRejectedValue(Object.assign(new Error("unsafe"), { status: 503 }));

  // @ts-expect-error The executable JavaScript smoke entry has no declaration file.
  await import("../../scripts/yandex-smoke.mjs");

  expect(process.exitCode).toBe(1);
});

it("exits unsuccessfully when profile identity is unavailable", async () => {
  client.getProfile.mockResolvedValue(undefined);

  // @ts-expect-error The executable JavaScript smoke entry has no declaration file.
  await import("../../scripts/yandex-smoke.mjs");

  expect(process.exitCode).toBe(1);
  expect(client.getMyLibrary).not.toHaveBeenCalled();
  expect(client.exportBookQuotes).not.toHaveBeenCalled();
});
