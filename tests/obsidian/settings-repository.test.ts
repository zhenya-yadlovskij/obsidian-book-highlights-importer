import { describe, expect, it, vi, type Mock } from "vitest";

import type { ImportSettings } from "../../src/core/ports";
import { createObsidianSettingsRepository } from "../../src/obsidian/settings-repository";

const createHost = (stored: unknown): {
  loadData: Mock<() => Promise<unknown>>;
  saveData: Mock<(data: unknown) => Promise<void>>;
} => ({
  loadData: vi.fn<() => Promise<unknown>>().mockResolvedValue(stored),
  saveData: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
});

describe("Obsidian settings repository", () => {
  it.each([null, undefined, [], "invalid", { version: 2, defaultFolder: "Legacy" }])(
    "uses vault-root defaults for unsupported stored data %#",
    async (stored) => {
      const repository = createObsidianSettingsRepository(createHost(stored));

      await expect(repository.load()).resolves.toEqual({ defaultFolder: "" });
    },
  );

  it("loads only valid version-1 folder settings", async () => {
    const repository = createObsidianSettingsRepository(createHost({
      version: 1,
      defaultFolder: "Books",
      lastFolder: "Archive",
      oauthToken: "must-not-leak",
    }));

    await expect(repository.load()).resolves.toEqual({
      defaultFolder: "Books",
      lastFolder: "Archive",
    });
  });

  it("defaults missing version-1 fields without retaining malformed values", async () => {
    const repository = createObsidianSettingsRepository(createHost({
      version: 1,
      defaultFolder: 42,
      lastFolder: false,
    }));

    await expect(repository.load()).resolves.toEqual({ defaultFolder: "" });
  });

  it("serializes a fresh version-1 whitelist without raw credentials", async () => {
    const host = createHost(null);
    const repository = createObsidianSettingsRepository(host);
    const settings = {
      defaultFolder: "Books",
      lastFolder: "Archive",
      yandexBooksToken: "must-not-leak",
    } as ImportSettings;

    await repository.update(() => settings);

    expect(host.saveData).toHaveBeenCalledOnce();
    expect(host.saveData).toHaveBeenCalledWith({
      version: 1,
      defaultFolder: "Books",
      lastFolder: "Archive",
    });
    expect(JSON.stringify(host.saveData.mock.calls[0]?.[0])).not.toContain("must-not-leak");
  });

  it("omits an absent last folder from persisted data", async () => {
    const host = createHost(null);
    const repository = createObsidianSettingsRepository(host);

    await repository.update(() => ({ defaultFolder: "Books" }));

    expect(host.saveData).toHaveBeenCalledWith({ version: 1, defaultFolder: "Books" });
  });

  it("serializes updates against the latest persisted settings", async () => {
    const host = createHost({ version: 1, defaultFolder: "Books", lastFolder: "Archive" });
    const repository = createObsidianSettingsRepository(host);

    const defaultFolder = repository.update((current) => ({ ...current, defaultFolder: "Finished" }));
    const lastFolder = repository.update((current) => ({ ...current, lastFolder: "Recent" }));

    await expect(Promise.all([defaultFolder, lastFolder])).resolves.toEqual([
      { defaultFolder: "Finished", lastFolder: "Archive" },
      { defaultFolder: "Finished", lastFolder: "Recent" },
    ]);
    expect(host.saveData).toHaveBeenNthCalledWith(1, {
      version: 1,
      defaultFolder: "Finished",
      lastFolder: "Archive",
    });
    expect(host.saveData).toHaveBeenNthCalledWith(2, {
      version: 1,
      defaultFolder: "Finished",
      lastFolder: "Recent",
    });
  });

  it("shares an in-flight load with updates instead of restoring stale cached settings", async () => {
    let resolveLoad!: (value: unknown) => void;
    const firstLoad = new Promise<unknown>((resolve) => {
      resolveLoad = resolve;
    });
    const host = {
      loadData: vi.fn<() => Promise<unknown>>()
        .mockImplementationOnce(() => firstLoad)
        .mockResolvedValue({ version: 1, defaultFolder: "Books" }),
      saveData: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
    };
    const repository = createObsidianSettingsRepository(host);
    const loading = repository.load();
    await Promise.resolve();
    const updating = repository.update((current) => ({ ...current, defaultFolder: "Finished" }));

    expect(host.loadData).toHaveBeenCalledOnce();
    resolveLoad({ version: 1, defaultFolder: "Books" });
    await expect(Promise.all([loading, updating])).resolves.toEqual([
      { defaultFolder: "Books" },
      { defaultFolder: "Finished" },
    ]);
    await repository.update((current) => ({ ...current, lastFolder: "Recent" }));
    expect(host.saveData).toHaveBeenLastCalledWith({
      version: 1,
      defaultFolder: "Finished",
      lastFolder: "Recent",
    });
  });

  it("propagates plugin-data failures for the use case to classify", async () => {
    const loadFailure = new Error("load failed");
    const saveFailure = new Error("save failed");
    const host = {
      loadData: vi.fn().mockRejectedValue(loadFailure),
      saveData: vi.fn().mockRejectedValue(saveFailure),
    };
    const repository = createObsidianSettingsRepository(host);

    await expect(repository.load()).rejects.toBe(loadFailure);
    await expect(repository.update(() => ({ defaultFolder: "" }))).rejects.toBe(loadFailure);

    const saveRepository = createObsidianSettingsRepository({
      loadData: vi.fn().mockResolvedValue(null),
      saveData: vi.fn().mockRejectedValue(saveFailure),
    });
    await expect(saveRepository.update(() => ({ defaultFolder: "" }))).rejects.toBe(saveFailure);
  });
});
