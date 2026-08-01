import { createImportUseCase, type ImportDependencies, type ImportUseCase } from "./import";
import type { ProviderBook } from "./models";
import type { ImportError, Result } from "./results";
import { failure } from "./results";
import { createProviderRegistry, type ProviderRegistry } from "./registry";
import type { ReadingProviderPort } from "./ports";

export interface CoreComposition {
  readonly registry: ProviderRegistry;
  readonly settingsProviders: () => readonly ReadingProviderPort[];
  readonly providerForImport: (providerId: string) => ReadingProviderPort | undefined;
  readonly loadLibrary: (providerId: string) => Promise<Result<readonly ProviderBook[], ImportError>>;
  readonly importUseCase: ImportUseCase;
}

/** Core startup seam: compiled-in adapters are shared by settings and imports. */
export const createCoreComposition = (
  providers: readonly ReadingProviderPort[],
  dependencies: ImportDependencies,
): CoreComposition => {
  const registry = createProviderRegistry(providers);
  const importUseCase = createImportUseCase(dependencies);
  const loadLibrary = async (providerId: string): Promise<Result<readonly ProviderBook[], ImportError>> => {
    const provider = registry.get(providerId);
    return provider === undefined
      ? failure({ category: "provider-not-registered", providerId })
      : importUseCase.loadLibrary(provider);
  };

  return Object.freeze({
    registry,
    settingsProviders: registry.all,
    providerForImport: registry.get,
    loadLibrary,
    importUseCase,
  });
};
