import type { App, PluginManifest } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportUseCase } from "../src/core/import";
import type { CredentialStorePort, SettingsRepositoryPort } from "../src/core/ports";
import type { ProviderRegistry } from "../src/core/registry";
import type { ImportModalDependencies } from "../src/obsidian/import-modal";

interface RegisteredCommand {
  readonly id: string;
  readonly name: string;
  readonly callback?: () => void;
}

interface CapturedSettingsTab {
  readonly registry: ProviderRegistry;
  readonly credentials: CredentialStorePort;
  readonly settings: SettingsRepositoryPort;
  readonly imports: Pick<ImportUseCase, "testCredential">;
}

interface CapturedImportModal {
  readonly dependencies: ImportModalDependencies;
  opened: boolean;
  closed: boolean;
  closeCalls: number;
  forcedCloseCalls: number;
  close(): void;
  closeForUnload(): void;
}

const host = vi.hoisted(() => ({
  registeredCommands: [] as RegisteredCommand[],
  addedSettingsTabs: [] as unknown[],
  constructedImportModals: [] as unknown[],
  openedImportModals: [] as unknown[],
  clientFactoryCalls: [] as { credential: string; transport: unknown }[],
  requestUrl: vi.fn(),
  loadData: vi.fn<() => Promise<unknown>>(),
  saveData: vi.fn<(data: unknown) => Promise<void>>(),
  getProfile: vi.fn<() => Promise<{ login: string }>>(),
}));

vi.mock("obsidian", () => ({
  Plugin: class Plugin {
    readonly app: App;

    constructor(app: App) {
      this.app = app;
    }

    addCommand(command: RegisteredCommand): void {
      host.registeredCommands.push(command);
    }

    addSettingTab(tab: unknown): void {
      host.addedSettingsTabs.push(tab);
    }

    loadData(): Promise<unknown> {
      return host.loadData();
    }

    saveData(data: unknown): Promise<void> {
      return host.saveData(data);
    }
  },
  requestUrl: host.requestUrl,
}));

vi.mock("../src/obsidian/provider-settings-tab", () => ({
  BookHighlightsSettingsTab: class BookHighlightsSettingsTab implements CapturedSettingsTab {
    constructor(
      readonly _app: App,
      readonly _plugin: unknown,
      readonly registry: ProviderRegistry,
      readonly credentials: CredentialStorePort,
      readonly imports: Pick<ImportUseCase, "testCredential">,
      readonly settings: SettingsRepositoryPort,
    ) {}
  },
}));

vi.mock("../src/obsidian/import-modal", () => ({
  ImportBookHighlightsModal: class ImportBookHighlightsModal implements CapturedImportModal {
    opened = false;
    closed = false;
    closeCalls = 0;
    forcedCloseCalls = 0;

    constructor(
      readonly _app: App,
      readonly dependencies: ImportModalDependencies,
      private readonly onClosed?: () => void,
    ) {
      host.constructedImportModals.push(this);
    }

    open(): void {
      this.opened = true;
      host.openedImportModals.push(this);
    }

    close(): void {
      if (this.closed) return;
      this.closed = true;
      this.opened = false;
      this.closeCalls += 1;
      this.onClosed?.();
    }

    closeForUnload(): void {
      this.forcedCloseCalls += 1;
      this.close();
    }
  },
}));

vi.mock("../src/obsidian/yandex-client", () => ({
  createObsidianYandexClient: (credential: string, transport: unknown): object => {
    host.clientFactoryCalls.push({ credential, transport });
    return {
      getProfile: host.getProfile,
      getMyLibrary: vi.fn(() => Promise.resolve([])),
      getUserQuotes: vi.fn(() => Promise.resolve([])),
    };
  },
}));

import BookHighlightsImporterPlugin from "../src/main";

const command = (id: string): RegisteredCommand => {
  const registered = host.registeredCommands.find((candidate) => candidate.id === id);
  if (registered === undefined) throw new Error(`Missing command: ${id}`);
  return registered;
};

const settingsTab = (): CapturedSettingsTab => {
  const tab = host.addedSettingsTabs[0];
  if (tab === undefined) throw new Error("Missing settings tab");
  return tab as CapturedSettingsTab;
};

const importModal = (): CapturedImportModal => {
  const modal = host.constructedImportModals[0];
  if (modal === undefined) throw new Error("Missing import modal");
  return modal as CapturedImportModal;
};

const createPlugin = (): {
  readonly plugin: BookHighlightsImporterPlugin;
  readonly getSecret: ReturnType<typeof vi.fn>;
  readonly getFileByPath: ReturnType<typeof vi.fn>;
  readonly getLeaf: ReturnType<typeof vi.fn>;
  readonly openFile: ReturnType<typeof vi.fn>;
} => {
  const getSecret = vi.fn().mockReturnValue("configured-token");
  const file = { path: "Books/Dune.md" };
  const getFileByPath = vi.fn().mockReturnValue(file);
  const openFile = vi.fn().mockResolvedValue(undefined);
  const getLeaf = vi.fn().mockReturnValue({ openFile });
  const app = {
    secretStorage: {
      getSecret,
      setSecret: vi.fn(),
    },
    vault: {
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
      getFileByPath,
      create: vi.fn(),
      process: vi.fn(),
    },
    workspace: { getLeaf },
  } as unknown as App;
  return {
    plugin: new BookHighlightsImporterPlugin(app, {} as PluginManifest),
    getSecret,
    getFileByPath,
    getLeaf,
    openFile,
  };
};

describe("BookHighlightsImporterPlugin lifecycle", () => {
  beforeEach(() => {
    host.registeredCommands.length = 0;
    host.addedSettingsTabs.length = 0;
    host.constructedImportModals.length = 0;
    host.openedImportModals.length = 0;
    host.clientFactoryCalls.length = 0;
    host.requestUrl.mockReset();
    host.loadData.mockReset().mockResolvedValue({ version: 1, defaultFolder: "Books" });
    host.saveData.mockReset().mockResolvedValue(undefined);
    host.getProfile.mockReset().mockResolvedValue({ login: "reader" });
  });

  it("registers the import command and one provider settings tab without eager host or provider calls", async () => {
    const fixture = createPlugin();

    await expect(fixture.plugin.onload()).resolves.toBeUndefined();

    expect(host.registeredCommands.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "import-book-highlights", name: "Import Book Highlights" },
    ]);
    expect(host.addedSettingsTabs).toHaveLength(1);
    expect(settingsTab().registry.all().map((provider) => provider.id)).toEqual(["yandex-books"]);
    expect(host.constructedImportModals).toHaveLength(0);
    expect(host.clientFactoryCalls).toHaveLength(0);
    expect(host.requestUrl).not.toHaveBeenCalled();
    expect(host.getProfile).not.toHaveBeenCalled();
    expect(host.loadData).not.toHaveBeenCalled();
    expect(fixture.getSecret).not.toHaveBeenCalled();
    expect(fixture.getFileByPath).not.toHaveBeenCalled();
    expect(fixture.getLeaf).not.toHaveBeenCalled();
  });

  it("opens one import modal with the shared registry, adapters, use case, and retry-open callback", async () => {
    const fixture = createPlugin();
    await fixture.plugin.onload();

    command("import-book-highlights").callback?.();

    expect(host.constructedImportModals).toHaveLength(1);
    expect(host.openedImportModals).toHaveLength(1);
    const modal = importModal();
    const tab = settingsTab();
    expect(modal.opened).toBe(true);
    expect(modal.dependencies.registry).toBe(tab.registry);
    expect(modal.dependencies.credentials).toBe(tab.credentials);
    expect(modal.dependencies.settings).toBe(tab.settings);
    expect(modal.dependencies.imports).toBe(tab.imports);
    expect(modal.dependencies.credentials.get("yandex-books")).toBe("configured-token");
    await expect(modal.dependencies.settings.load()).resolves.toEqual({ defaultFolder: "Books" });

    await modal.dependencies.openNote("Books/Dune.md");
    expect(fixture.getFileByPath).toHaveBeenCalledWith("Books/Dune.md");
    expect(fixture.getLeaf).toHaveBeenCalledWith(false);
    expect(fixture.openFile).toHaveBeenCalledWith({ path: "Books/Dune.md" });

    const provider = modal.dependencies.registry.get("yandex-books");
    if (provider === undefined) throw new Error("Missing Yandex provider");
    await expect(provider.testCredential("current-token")).resolves.toEqual({ ok: true, value: undefined });
    expect(host.clientFactoryCalls).toEqual([{ credential: "current-token", transport: host.requestUrl }]);
    expect(host.getProfile).toHaveBeenCalledOnce();
    expect(host.requestUrl).not.toHaveBeenCalled();
  });

  it("closes tracked modals on unload and does not retain modals users closed normally", async () => {
    const { plugin } = createPlugin();
    await plugin.onload();

    command("import-book-highlights").callback?.();
    command("import-book-highlights").callback?.();
    const firstImport = host.constructedImportModals[0] as CapturedImportModal | undefined;
    const secondImport = host.constructedImportModals[1] as CapturedImportModal | undefined;
    if (firstImport === undefined || secondImport === undefined) throw new Error("Missing import modals");
    firstImport.close();

    plugin.onunload();

    expect(firstImport).toMatchObject({ closed: true, closeCalls: 1, forcedCloseCalls: 0 });
    expect(secondImport).toMatchObject({ closed: true, closeCalls: 1, forcedCloseCalls: 1 });
    plugin.onunload();
    expect(secondImport).toMatchObject({ closeCalls: 1, forcedCloseCalls: 1 });
  });
});
