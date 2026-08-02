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

    await repository.save(settings);

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

    await repository.save({ defaultFolder: "Books" });

    expect(host.saveData).toHaveBeenCalledWith({ version: 1, defaultFolder: "Books" });
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
    await expect(repository.save({ defaultFolder: "" })).rejects.toBe(saveFailure);
  });
});
