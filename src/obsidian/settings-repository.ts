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

export const createObsidianSettingsRepository = (host: PluginDataHost): SettingsRepositoryPort => ({
  load: async () => loadSettings(await host.loadData()),
  save: async (settings) => host.saveData(saveSettings(settings)),
});
