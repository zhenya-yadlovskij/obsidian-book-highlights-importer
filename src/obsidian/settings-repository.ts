import type { ImportSettings, SettingsRepositoryPort } from "../core/ports";

interface PluginDataHost {
  readonly loadData: () => Promise<unknown>;
  readonly saveData: (data: unknown) => Promise<void>;
}

interface PluginSettingsV1 {
  readonly version: 1;
  readonly defaultFolder: string;
  readonly lastFolder?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const loadSettings = (value: unknown): ImportSettings => {
  if (!isRecord(value) || value.version !== 1) return { defaultFolder: "" };

  const defaultFolder = typeof value.defaultFolder === "string" ? value.defaultFolder : "";
  return typeof value.lastFolder === "string"
    ? { defaultFolder, lastFolder: value.lastFolder }
    : { defaultFolder };
};

const saveSettings = (settings: ImportSettings): PluginSettingsV1 =>
  settings.lastFolder === undefined
    ? { version: 1, defaultFolder: settings.defaultFolder }
    : { version: 1, defaultFolder: settings.defaultFolder, lastFolder: settings.lastFolder };

export const createObsidianSettingsRepository = (host: PluginDataHost): SettingsRepositoryPort => {
  let updateQueue: Promise<void> = Promise.resolve();
  let cachedSettings: ImportSettings | undefined;
  let pendingLoad: Promise<ImportSettings> | undefined;

  const readSettings = (): Promise<ImportSettings> => {
    if (cachedSettings !== undefined) return Promise.resolve(cachedSettings);
    if (pendingLoad !== undefined) return pendingLoad;
    pendingLoad ??= host.loadData()
      .then((stored) => {
        cachedSettings ??= loadSettings(stored);
        return cachedSettings;
      })
      .finally(() => {
        pendingLoad = undefined;
      });
    return pendingLoad;
  };

  const update = (change: (current: ImportSettings) => ImportSettings): Promise<ImportSettings> => {
    const operation = updateQueue.then(async () => {
      const current = await readSettings();
      const updated = change(current);
      await host.saveData(saveSettings(updated));
      cachedSettings = updated;
      return updated;
    });
    updateQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  return {
    load: async (): Promise<ImportSettings> => {
      return readSettings();
    },
    update,
  };
};
