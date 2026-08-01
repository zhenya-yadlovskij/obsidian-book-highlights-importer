import { describe, expect, it } from "vitest";
import { createProviderRegistry } from "../../src/core/registry";
import type { ReadingProviderPort } from "../../src/core/ports";

const provider = (id: string): ReadingProviderPort => ({
  id,
  displayName: id,
  annotationFetch: "early",
  testCredential: () => Promise.resolve({ ok: true as const, value: undefined }),
  listBooks: () => Promise.resolve({ ok: true as const, value: [] }),
  fetchAnnotations: () => Promise.resolve({ ok: true as const, value: [] }),
});

describe("provider registry", () => {
  it("exposes every compile-time registered provider without runtime loading", () => {
    const yandex = provider("yandex-books");
    const litres = provider("litres");
    const registry = createProviderRegistry([yandex, litres] as const);

    expect(registry.all()).toEqual([yandex, litres]);
    expect(registry.get("litres")).toBe(litres);
    expect(registry.get("missing")).toBeUndefined();
  });

  it("does not allow mutation through the registry collection", () => {
    const registry = createProviderRegistry([provider("one")] as const);

    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.all())).toBe(true);
  });
});
