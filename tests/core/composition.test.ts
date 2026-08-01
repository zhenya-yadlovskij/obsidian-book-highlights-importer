import { describe, expect, it, vi } from "vitest";
import { createCoreComposition } from "../../src/core/composition";
import { createProviderBook } from "../../src/core/models";
import type { ReadingProviderPort } from "../../src/core/ports";

const provider = (id: string): ReadingProviderPort => ({
  id,
  displayName: id,
  annotationFetch: "deferred",
  testCredential: () => Promise.resolve({ ok: true as const, value: undefined }),
  listBooks: vi.fn(() => Promise.resolve({
    ok: true as const,
    value: [createProviderBook({ providerId: id, bookId: "book", title: id, authors: [], status: "unknown" })],
  })),
  fetchAnnotations: () => Promise.resolve({ ok: true as const, value: [] }),
});

describe("core composition", () => {
  it("uses one frozen registry for settings discovery and provider imports", async () => {
    const registered = provider("registered");
    const composition = createCoreComposition([registered], {
      credentials: { get: () => "credential" },
      settings: { load: () => Promise.resolve({ defaultFolder: "Books" }), save: () => Promise.resolve() },
      notes: { inspect: vi.fn(), create: vi.fn(), process: vi.fn(), open: vi.fn() },
    });

    expect(composition.registry.get("registered")).toBe(registered);
    expect(composition.providerForImport("registered")).toBe(registered);
    expect(composition.settingsProviders()).toEqual([registered]);
    expect(await composition.loadLibrary("registered")).toMatchObject({ ok: true });
    expect(registered.listBooks).toHaveBeenCalledWith("credential");
    expect(await composition.loadLibrary("not-registered")).toEqual({
      ok: false,
      error: { category: "provider-not-registered", providerId: "not-registered" },
    });
  });
});
