import type { App, Plugin } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportSettings, ProviderResult, ReadingProviderPort, SettingsRepositoryPort } from "../../src/core/ports";
import { createProviderRegistry } from "../../src/core/registry";

interface FakeText {
  readonly inputEl: { type: string };
  value: string;
  placeholder: string;
  disabled: boolean;
  change(value: string): Promise<void>;
}

interface FakeButton {
  text: string;
  disabled: boolean;
  readonly disabledHistory: boolean[];
  click(): Promise<void>;
}

interface FakeSetting {
  name: string;
  description: string;
  readonly texts: FakeText[];
  readonly buttons: FakeButton[];
}

const { notices, openedExternalUrls, renderedSettings, suggestionSelections } = vi.hoisted(() => ({
  notices: [] as string[],
  openedExternalUrls: [] as string[],
  renderedSettings: [] as FakeSetting[],
  suggestionSelections: [] as ((value: string) => void)[],
}));

vi.mock("obsidian", () => {
  class TextComponent implements FakeText {
    readonly inputEl = { type: "text" };
    value = "";
    placeholder = "";
    disabled = false;
    private onChangeCallback: (value: string) => void | Promise<void> = () => undefined;

    setValue(value: string): this {
      this.value = value;
      return this;
    }

    setPlaceholder(value: string): this {
      this.placeholder = value;
      return this;
    }

    setDisabled(value: boolean): this {
      this.disabled = value;
      return this;
    }

    onChange(callback: (value: string) => void | Promise<void>): this {
      this.onChangeCallback = callback;
      return this;
    }

    async change(value: string): Promise<void> {
      this.value = value;
      await this.onChangeCallback(value);
    }
  }

  class ButtonComponent implements FakeButton {
    text = "";
    disabled = false;
    readonly disabledHistory: boolean[] = [];
    private onClickCallback: () => void | Promise<void> = () => undefined;

    setButtonText(value: string): this {
      this.text = value;
      return this;
    }

    setCta(): this {
      return this;
    }

    setDisabled(value: boolean): this {
      this.disabled = value;
      this.disabledHistory.push(value);
      return this;
    }

    onClick(callback: () => void | Promise<void>): this {
      this.onClickCallback = callback;
      return this;
    }

    async click(): Promise<void> {
      await this.onClickCallback();
    }
  }

  class Setting implements FakeSetting {
    name = "";
    description = "";
    readonly texts: FakeText[] = [];
    readonly buttons: FakeButton[] = [];

    constructor() {
      renderedSettings.push(this);
    }

    setName(value: string): this {
      this.name = value;
      return this;
    }

    setDesc(value: string): this {
      this.description = value;
      return this;
    }

    addText(callback: (text: TextComponent) => void): this {
      const text = new TextComponent();
      this.texts.push(text);
      callback(text);
      return this;
    }

    addButton(callback: (button: ButtonComponent) => void): this {
      const button = new ButtonComponent();
      this.buttons.push(button);
      callback(button);
      return this;
    }
  }

  class AbstractInputSuggest<T> {
    private selection: (value: T) => void = () => undefined;

    constructor() {
      suggestionSelections.push((value) => {
        this.selection(value as T);
      });
    }

    onSelect(callback: (value: T) => void): this {
      this.selection = callback;
      return this;
    }

    close(): void {
      return;
    }
  }

  return {
    Notice: class Notice {
      readonly message: string;

      constructor(message: string) {
        this.message = message;
        notices.push(message);
      }
    },
    PluginSettingTab: class PluginSettingTab {
      readonly containerEl = { empty: vi.fn() };

      hide(): void {
        this.containerEl.empty();
      }
    },
    AbstractInputSuggest,
    Setting,
  };
});

import { BookHighlightsSettingsTab } from "../../src/obsidian/provider-settings-tab";

const provider = (id: string, displayName: string): ReadingProviderPort => ({
  id,
  displayName,
  annotationFetch: "early",
  testCredential: () => Promise.resolve({ ok: true, value: undefined }),
  listBooks: () => Promise.resolve({ ok: true, value: [] }),
  fetchAnnotations: () => Promise.resolve({ ok: true, value: [] }),
});

const settingsRepository = (settings: ImportSettings = { defaultFolder: "" }): SettingsRepositoryPort => ({
  load: () => Promise.resolve(settings),
  update: (change) => Promise.resolve(change(settings)),
});

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

const settingNamed = (name: string): FakeSetting => {
  const setting = renderedSettings.find((candidate) => candidate.name === name);
  if (setting === undefined) throw new Error(`Missing setting: ${name}`);
  return setting;
};

describe("provider settings tab", () => {
  beforeEach(() => {
    notices.length = 0;
    openedExternalUrls.length = 0;
    renderedSettings.length = 0;
    suggestionSelections.length = 0;
  });

  it("discovers every registry provider and never redisplays configured credentials", () => {
    const registry = createProviderRegistry([
      provider("yandex-books", "Yandex Books"),
      provider("litres", "LitRes"),
    ]);
    const credentials = {
      get: vi.fn((providerId: string) => providerId === "yandex-books" ? "stored-secret" : null),
      set: vi.fn(),
      clear: vi.fn(),
    };
    const tab = new BookHighlightsSettingsTab({} as App, {} as Plugin, registry, credentials, {
      testCredential: vi.fn(),
    }, settingsRepository());

    tab.render();

    const yandex = settingNamed("Yandex Books");
    const litres = settingNamed("LitRes");
    expect(yandex.description).toBe("Configured");
    expect(litres.description).toBe("Not configured");
    expect(yandex.texts[0]).toMatchObject({
      value: "",
      placeholder: "Yandex OAuth token",
      inputEl: { type: "password" },
    });
    expect(litres.texts[0]).toMatchObject({ value: "", inputEl: { type: "password" } });
    expect(JSON.stringify(renderedSettings)).not.toContain("stored-secret");
  });

  it("explains how to obtain a Yandex OAuth token and opens authorization", async () => {
    const set = vi.fn();
    const clear = vi.fn();
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([provider("yandex-books", "Yandex Books")]),
      { get: (): null => null, set, clear },
      { testCredential: vi.fn() },
      settingsRepository(),
      (url: string): void => {
        openedExternalUrls.push(url);
      },
    );

    tab.render();

    const guidance = settingNamed("Yandex OAuth token");
    const yandex = settingNamed("Yandex Books");
    expect(yandex.texts[0]).toMatchObject({ placeholder: "Yandex OAuth token" });
    expect(guidance.description).toContain("authorize Yandex");
    expect(guidance.description).toContain("copy the y0_... token from the browser URL");
    expect(guidance.description).toContain("paste it into the field");
    const getToken = guidance.buttons.find((button) => button.text === "Get Yandex OAuth token");
    if (getToken === undefined) throw new Error("Missing Yandex OAuth token button");

    await getToken.click();

    expect(openedExternalUrls).toEqual([
      "https://oauth.yandex.ru/authorize?response_type=token&client_id=4483e97bab6e486a9822973109a14d05",
    ]);
    expect(set).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it("keeps replacement guidance visible for a configured Yandex token", () => {
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([provider("yandex-books", "Yandex Books")]),
      { get: (): string => "stored-token", set: vi.fn(), clear: vi.fn() },
      { testCredential: vi.fn() },
      settingsRepository(),
    );

    tab.render();

    const guidance = settingNamed("Yandex OAuth token");
    const yandex = settingNamed("Yandex Books");
    expect(guidance.description).toContain("authorize Yandex");
    expect(yandex.texts[0]).toMatchObject({ placeholder: "Yandex OAuth token", value: "" });
    expect(JSON.stringify(renderedSettings)).not.toContain("stored-token");
  });

  it("saves, replaces, and clears only the temporary provider credential", async () => {
    let stored: string | null = null;
    const credentials = {
      get: vi.fn((): string | null => stored),
      set: vi.fn((_providerId: string, credential: string) => {
        stored = credential;
      }),
      clear: vi.fn(() => {
        stored = null;
      }),
    };
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([provider("yandex-books", "Yandex Books")]),
      credentials,
      { testCredential: vi.fn() },
      settingsRepository(),
    );
    tab.render();
    const setting = settingNamed("Yandex Books");
    const input = setting.texts[0];
    const save = setting.buttons.find((button) => button.text === "Save or replace");
    const clear = setting.buttons.find((button) => button.text === "Clear");
    if (input === undefined || save === undefined || clear === undefined) throw new Error("Missing provider controls");

    await input.change("  replacement-token  ");
    await save.click();

    expect(credentials.set).toHaveBeenCalledWith("yandex-books", "replacement-token");
    expect(input.value).toBe("");
    expect(setting.description).toBe("Configured");

    await clear.click();

    expect(credentials.clear).toHaveBeenCalledWith("yandex-books");
    expect(setting.description).toBe("Not configured");
    expect(JSON.stringify({ notices, renderedSettings })).not.toContain("replacement-token");
  });

  it("shows distinct success, authentication, and unavailable connection states", async () => {
    const results = [
      { ok: true as const, value: undefined },
      { ok: false as const, error: { category: "authentication" as const, providerId: "yandex-books" } },
      { ok: false as const, error: { category: "provider-unavailable" as const, providerId: "yandex-books" } },
    ];
    const testCredential = vi.fn()
      .mockResolvedValueOnce(results[0])
      .mockResolvedValueOnce(results[1])
      .mockResolvedValueOnce(results[2]);
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([provider("yandex-books", "Yandex Books")]),
      { get: (): string | null => "configured", set: vi.fn(), clear: vi.fn() },
      { testCredential },
      settingsRepository(),
    );
    tab.render();
    const setting = settingNamed("Yandex Books");
    const testButton = setting.buttons.find((button) => button.text === "Test connection");
    if (testButton === undefined) throw new Error("Missing test button");

    await testButton.click();
    expect(setting.description).toBe("Connection successful");
    await testButton.click();
    expect(setting.description).toBe("Authentication failed. Replace the credential and retry.");
    await testButton.click();
    expect(setting.description).toBe("Provider unavailable. Retry the connection test.");
    expect(testButton.disabledHistory).toEqual([true, false, true, false, true, false]);
  });

  it("redacts credential-bearing host failures from settings output", async () => {
    const secret = "credential-that-must-not-appear";
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([provider("yandex-books", "Yandex Books")]),
      {
        get: (): string | null => null,
        set: (): void => {
          throw new Error(`SecretStorage rejected ${secret}`);
        },
        clear: (): void => {
          throw new Error(`SecretStorage retained ${secret}`);
        },
      },
      {
        testCredential: (): Promise<never> => Promise.reject(new Error(`Provider rejected ${secret}`)),
      },
      settingsRepository(),
    );
    tab.render();
    const setting = settingNamed("Yandex Books");
    const input = setting.texts[0];
    const save = setting.buttons.find((button) => button.text === "Save or replace");
    const clear = setting.buttons.find((button) => button.text === "Clear");
    const test = setting.buttons.find((button) => button.text === "Test connection");
    if (input === undefined || save === undefined || clear === undefined || test === undefined) {
      throw new Error("Missing provider controls");
    }

    await input.change(secret);
    await save.click();
    await clear.click();
    await test.click();

    expect(notices).toEqual([
      "Could not save the provider credential.",
      "Could not clear the provider credential.",
    ]);
    expect(setting.description).toBe("Provider unavailable. Retry the connection test.");
    expect(JSON.stringify({ notices, description: setting.description })).not.toContain(secret);
  });

  it("keeps one enabled folder input through incremental typing and saves automatically after a pause", async () => {
    const update = vi.fn((change: (current: ImportSettings) => ImportSettings) => Promise.resolve(change({
      defaultFolder: "Library",
      lastFolder: "Recent imports",
    })));
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([]),
      { get: (): null => null, set: vi.fn(), clear: vi.fn() },
      { testCredential: vi.fn() },
      {
        load: (): Promise<ImportSettings> => Promise.resolve({ defaultFolder: "Library", lastFolder: "Recent imports" }),
        update,
      },
    );

    tab.render();
    const setting = settingNamed("Default import folder");
    const input = setting.texts[0];
    if (input === undefined) throw new Error("Missing default folder input");
    await vi.waitFor(() => {
      expect(input).toMatchObject({ value: "Library", disabled: false });
    });

    vi.useFakeTimers();
    try {
      await input.change("B");
      await input.change("Bo");
      await input.change("Books");
      expect(setting.texts[0]).toBe(input);
      expect(input).toMatchObject({ value: "Books", disabled: false });
      expect(update).not.toHaveBeenCalled();

      vi.advanceTimersByTime(299);
      await Promise.resolve();
      expect(update).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();

      expect(update).toHaveBeenCalledOnce();
      expect(update).toHaveBeenCalledWith(expect.any(Function));
      expect(setting.description).toBe("Default import folder saved.");
      expect(input.disabled).toBe(false);
      expect(setting.buttons).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows fixed safe status and notices when default-folder loading or saving fails", async () => {
    const secret = "host-detail-that-must-not-appear";
    const loadFailure = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([]),
      { get: (): null => null, set: vi.fn(), clear: vi.fn() },
      { testCredential: vi.fn() },
      {
        load: (): Promise<ImportSettings> => Promise.reject(new Error(secret)),
        update: vi.fn(),
      },
    );
    loadFailure.render();
    const failedLoadSetting = settingNamed("Default import folder");
    await vi.waitFor(() => {
      expect(failedLoadSetting.description).toBe("Could not load import settings.");
    });
    expect(failedLoadSetting.texts[0]?.disabled).toBe(true);
    expect(failedLoadSetting.buttons).toEqual([]);

    renderedSettings.length = 0;
    const update = vi.fn((): Promise<ImportSettings> => Promise.reject(new Error(secret)));
    const saveFailure = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([]),
      { get: (): null => null, set: vi.fn(), clear: vi.fn() },
      { testCredential: vi.fn() },
      {
        load: (): Promise<ImportSettings> => Promise.resolve({ defaultFolder: "Books", lastFolder: "Recent" }),
        update,
      },
    );
    saveFailure.render();
    const failedSaveSetting = settingNamed("Default import folder");
    const input = failedSaveSetting.texts[0];
    if (input === undefined) throw new Error("Missing default folder input");
    await vi.waitFor(() => {
      expect(input.disabled).toBe(false);
    });
    vi.useFakeTimers();
    try {
      await input.change("Changed");
      expect(update).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();

      expect(update).toHaveBeenCalledOnce();
      expect(input).toMatchObject({ value: "Changed", disabled: false });
      expect(failedSaveSetting.buttons).toEqual([]);
      expect(failedSaveSetting.description).toBe("Could not save default import folder.");
      expect(notices).toEqual(["Could not load import settings.", "Could not save default import folder."]);
      expect(JSON.stringify({ notices, renderedSettings })).not.toContain(secret);
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies a selected nested folder suggestion and persists it automatically", async () => {
    const update = vi.fn((change: (current: ImportSettings) => ImportSettings) => Promise.resolve(change({
      defaultFolder: "Books",
    })));
    const tab = new BookHighlightsSettingsTab(
      {
        vault: {
          getAllFolders: () => [{ path: "Books" }, { path: "Books/To Read" }],
        },
      } as App,
      {} as Plugin,
      createProviderRegistry([]),
      { get: (): null => null, set: vi.fn(), clear: vi.fn() },
      { testCredential: vi.fn() },
      { load: (): Promise<ImportSettings> => Promise.resolve({ defaultFolder: "Books" }), update },
    );
    tab.render();
    const setting = settingNamed("Default import folder");
    const input = setting.texts[0];
    if (input === undefined) throw new Error("Missing default folder input");
    await vi.waitFor(() => {
      expect(input.disabled).toBe(false);
    });
    const selectSuggestion = suggestionSelections.at(-1);
    if (selectSuggestion === undefined) throw new Error("Missing folder suggestion hook");

    vi.useFakeTimers();
    try {
      selectSuggestion("Books/To Read");
      expect(input.value).toBe("Books/To Read");
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
      expect(update).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a cleared provider not configured when an older connection test resolves", async () => {
    const pending = deferred<ProviderResult<void>>();
    const credentials = { get: (): string => "configured", set: vi.fn(), clear: vi.fn() };
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([provider("yandex-books", "Yandex Books")]),
      credentials,
      { testCredential: (): Promise<ProviderResult<void>> => pending.promise },
      settingsRepository(),
    );
    tab.render();
    const setting = settingNamed("Yandex Books");
    const test = setting.buttons.find((button) => button.text === "Test connection");
    const clear = setting.buttons.find((button) => button.text === "Clear");
    if (test === undefined || clear === undefined) throw new Error("Missing provider controls");

    const testing = test.click();
    await Promise.resolve();
    await clear.click();
    pending.resolve({ ok: true, value: undefined });
    await testing;

    expect(setting.description).toBe("Not configured");
    expect(test.disabled).toBe(false);
  });

  it("keeps a fixed save-failure status when an older connection test resolves", async () => {
    const pending = deferred<ProviderResult<void>>();
    const secret = "host-save-detail";
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([provider("yandex-books", "Yandex Books")]),
      {
        get: (): string => "configured",
        set: (): void => {
          throw new Error(secret);
        },
        clear: vi.fn(),
      },
      { testCredential: (): Promise<ProviderResult<void>> => pending.promise },
      settingsRepository(),
    );
    tab.render();
    const setting = settingNamed("Yandex Books");
    const input = setting.texts[0];
    const save = setting.buttons.find((button) => button.text === "Save or replace");
    const test = setting.buttons.find((button) => button.text === "Test connection");
    if (input === undefined || save === undefined || test === undefined) throw new Error("Missing provider controls");
    await input.change("replacement");

    const testing = test.click();
    await Promise.resolve();
    await save.click();
    expect(setting.description).toBe("Could not save provider credential. Configuration unchanged.");
    pending.resolve({ ok: true, value: undefined });
    await testing;

    expect(setting.description).toBe("Could not save provider credential. Configuration unchanged.");
    expect(test.disabled).toBe(false);
    expect(notices).toEqual(["Could not save the provider credential."]);
    expect(JSON.stringify({ notices, description: setting.description })).not.toContain(secret);
  });

  it("keeps a fixed clear-failure status when an older connection test resolves", async () => {
    const pending = deferred<ProviderResult<void>>();
    const secret = "host-clear-detail";
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([provider("yandex-books", "Yandex Books")]),
      {
        get: (): string => "configured",
        set: vi.fn(),
        clear: (): void => {
          throw new Error(secret);
        },
      },
      { testCredential: (): Promise<ProviderResult<void>> => pending.promise },
      settingsRepository(),
    );
    tab.render();
    const setting = settingNamed("Yandex Books");
    const clear = setting.buttons.find((button) => button.text === "Clear");
    const test = setting.buttons.find((button) => button.text === "Test connection");
    if (clear === undefined || test === undefined) throw new Error("Missing provider controls");

    const testing = test.click();
    await Promise.resolve();
    await clear.click();
    expect(setting.description).toBe("Could not clear provider credential. Configuration unchanged.");
    pending.resolve({ ok: true, value: undefined });
    await testing;

    expect(setting.description).toBe("Could not clear provider credential. Configuration unchanged.");
    expect(test.disabled).toBe(false);
    expect(notices).toEqual(["Could not clear the provider credential."]);
    expect(JSON.stringify({ notices, description: setting.description })).not.toContain(secret);
  });

  it("lets the newest connection test own provider status", async () => {
    const older = deferred<ProviderResult<void>>();
    const newer = deferred<ProviderResult<void>>();
    const testCredential = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const tab = new BookHighlightsSettingsTab(
      {} as App,
      {} as Plugin,
      createProviderRegistry([provider("yandex-books", "Yandex Books")]),
      { get: (): string => "configured", set: vi.fn(), clear: vi.fn() },
      { testCredential },
      settingsRepository(),
    );
    tab.render();
    const setting = settingNamed("Yandex Books");
    const test = setting.buttons.find((button) => button.text === "Test connection");
    if (test === undefined) throw new Error("Missing connection test control");

    const olderTest = test.click();
    const newerTest = test.click();
    newer.resolve({ ok: true, value: undefined });
    await newerTest;
    older.resolve({ ok: false, error: { category: "authentication", providerId: "yandex-books" } });
    await olderTest;

    expect(setting.description).toBe("Connection successful");
    expect(test.disabled).toBe(false);
  });
});
