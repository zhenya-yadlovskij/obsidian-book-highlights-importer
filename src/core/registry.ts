import type { ReadingProviderPort } from "./ports";

export interface ProviderRegistry {
  readonly all: () => readonly ReadingProviderPort[];
  readonly get: (id: string) => ReadingProviderPort | undefined;
}

export const createProviderRegistry = (providers: readonly ReadingProviderPort[]): ProviderRegistry => {
  const ids = new Set<string>();
  for (const provider of providers) {
    if (ids.has(provider.id)) {
      throw new Error(`Duplicate provider id: ${provider.id}`);
    }
    ids.add(provider.id);
  }

  const frozenProviders = Object.freeze([...providers]);
  const byId = new Map(frozenProviders.map((provider) => [provider.id, provider]));
  return Object.freeze({
    all: () => frozenProviders,
    get: (id: string) => byId.get(id),
  });
};
