import {
  Notice,
  PluginSettingTab,
  Setting,
  type App,
  type ButtonComponent,
  type Plugin,
  type SettingDefinitionItem,
  type TextComponent,
} from "obsidian";

import type { ImportUseCase } from "../core/import";
import type { CredentialStorePort, ImportError, ImportSettings, SettingsRepositoryPort } from "../core/ports";
import type { ProviderRegistry } from "../core/registry";
import { FolderSuggest, type FolderSource } from "./obsidian-folder-suggest";

const YANDEX_BOOKS_PROVIDER_ID = "yandex-books";
const YANDEX_OAUTH_URL = "https://oauth.yandex.ru/authorize?response_type=token&client_id=4483e97bab6e486a9822973109a14d05";

const connectionDescription = (error: ImportError): string => {
  switch (error.category) {
    case "missing-credential":
      return "Not configured";
    case "authentication":
      return "Authentication failed. Replace the credential and retry.";
    case "provider-unavailable":
      return "Provider unavailable. Retry the connection test.";
    case "incomplete-data":
      return "Provider returned incomplete data. Retry the connection test.";
    default:
      return "Connection test could not be completed.";
  }
};

export class BookHighlightsSettingsTab extends PluginSettingTab {
  private readonly appInstance: App;
  private readonly registry: ProviderRegistry;
  private readonly credentials: CredentialStorePort;
  private readonly imports: Pick<ImportUseCase, "testCredential">;
  private readonly settings: SettingsRepositoryPort;
  private readonly openExternalUrl: (url: string) => void;
  private readonly temporaryCredentials = new Map<string, string>();
  private readonly credentialInputs: TextComponent[] = [];
  private readonly connectionTestGenerations = new Map<string, number>();
  private defaultFolderCleanup: (() => void) | undefined;
  private defaultFolderSuggest: FolderSuggest | undefined;
  private renderGeneration = 0;

  constructor(
    app: App,
    plugin: Plugin,
    registry: ProviderRegistry,
    credentials: CredentialStorePort,
    imports: Pick<ImportUseCase, "testCredential">,
    settings: SettingsRepositoryPort,
    openExternalUrl?: (url: string) => void,
  ) {
    super(app, plugin);
    this.appInstance = app;
    this.registry = registry;
    this.credentials = credentials;
    this.imports = imports;
    this.settings = settings;
    this.openExternalUrl = openExternalUrl ?? ((url): void => {
      const link = this.containerEl.createEl("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      link.remove();
    });
  }

  override display(): void {
    this.render();
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    const renderGeneration = ++this.renderGeneration;
    this.clearDefaultFolderEditing();
    this.clearTemporaryCredentials();
    const definitions: SettingDefinitionItem[] = [{
      name: "Default import folder",
      desc: "Vault-relative folder used before any successful import.",
      searchable: true,
      render: (setting): void => {
        this.renderDefaultFolderSetting(setting, renderGeneration);
      },
    }];

    for (const provider of this.registry.all()) {
      if (provider.id === YANDEX_BOOKS_PROVIDER_ID) {
        definitions.push({
          name: "Yandex OAuth token",
          desc: "Authorize Yandex, copy the y0_... token from the browser URL, and paste it into the field.",
          searchable: true,
          render: (setting): void => {
            this.renderYandexOAuthSetup(setting);
          },
        });
      }
      definitions.push({
        name: provider.displayName,
        desc: "Configure, replace, clear, or test this provider credential.",
        searchable: true,
        render: (setting): void => {
          this.renderProviderSetting(setting, provider, renderGeneration);
        },
      });
    }
    return definitions;
  }

  render(): void {
    this.clearDefaultFolderEditing();
    const renderGeneration = ++this.renderGeneration;
    this.clearTemporaryCredentials();
    this.containerEl.empty();
    this.renderDefaultFolder(renderGeneration);

    for (const provider of this.registry.all()) {
      if (provider.id === YANDEX_BOOKS_PROVIDER_ID) {
        this.renderYandexOAuthSetup(new Setting(this.containerEl).setName("Yandex OAuth token"));
      }
      const setting = new Setting(this.containerEl)
        .setName(provider.displayName);
      this.renderProviderSetting(setting, provider, renderGeneration);
    }
  }

  private renderProviderSetting(setting: Setting, provider: ReturnType<ProviderRegistry["all"]>[number], renderGeneration: number): void {
    let configured = false;
    try {
      configured = this.credentials.get(provider.id) !== null;
    } catch {
      // The fixed status below avoids exposing host or secret details.
    }
    setting.setDesc(configured ? "Configured" : "Not configured");

    let input: TextComponent;
    let connectionButton!: ButtonComponent;

    setting.addText((text) => {
      input = text;
      this.credentialInputs.push(text);
      text.inputEl.type = "password";
      text.setPlaceholder(provider.id === YANDEX_BOOKS_PROVIDER_ID
        ? "Yandex OAuth token"
        : configured ? "Enter replacement credential" : "Enter credential");
      text.onChange((value) => {
        this.temporaryCredentials.set(provider.id, value);
      });
    });

    setting
      .addButton((button) => button
        .setButtonText("Save or replace")
        .setCta()
        .onClick(() => {
          this.invalidateConnectionTest(provider.id);
          connectionButton.setDisabled(false);
          setting.setDesc(configured ? "Configured" : "Not configured");
          const credential = this.temporaryCredentials.get(provider.id)?.trim() ?? "";
          if (credential === "") {
            new Notice("Enter a credential before saving.");
            return;
          }
          try {
            this.credentials.set(provider.id, credential);
            configured = true;
            this.temporaryCredentials.delete(provider.id);
            input.setValue("");
            setting.setDesc("Configured");
            new Notice(`${provider.displayName} credential saved.`);
          } catch {
            setting.setDesc("Could not save provider credential. Configuration unchanged.");
            new Notice("Could not save the provider credential.");
          }
        }))
      .addButton((button) => button
        .setButtonText("Clear")
        .onClick(() => {
          this.invalidateConnectionTest(provider.id);
          connectionButton.setDisabled(false);
          setting.setDesc(configured ? "Configured" : "Not configured");
          try {
            this.credentials.clear(provider.id);
            configured = false;
            this.temporaryCredentials.delete(provider.id);
            input.setValue("");
            setting.setDesc("Not configured");
            new Notice(`${provider.displayName} credential cleared.`);
          } catch {
            setting.setDesc("Could not clear provider credential. Configuration unchanged.");
            new Notice("Could not clear the provider credential.");
          }
        }))
      .addButton((button) => {
        connectionButton = button;
        button.setButtonText("Test connection")
          .onClick(async () => {
            const testGeneration = this.invalidateConnectionTest(provider.id);
            button.setDisabled(true);
            setting.setDesc("Testing connection...");
            try {
              const result = await this.imports.testCredential(provider);
              if (this.isCurrentConnectionTest(provider.id, testGeneration, renderGeneration)) {
                setting.setDesc(result.ok ? "Connection successful" : connectionDescription(result.error));
              }
            } catch {
              if (this.isCurrentConnectionTest(provider.id, testGeneration, renderGeneration)) {
                setting.setDesc("Provider unavailable. Retry the connection test.");
              }
            } finally {
              if (this.isCurrentConnectionTest(provider.id, testGeneration, renderGeneration)) {
                button.setDisabled(false);
              }
            }
          });
      });
  }

  override hide(): void {
    this.renderGeneration += 1;
    this.clearDefaultFolderEditing();
    this.clearTemporaryCredentials();
    super.hide();
  }

  private renderDefaultFolderSetting(setting: Setting, renderGeneration: number): void {
    const statusSetting = setting
      .setName("Default import folder")
      .setDesc("Loading import settings...");
    let currentSettings: ImportSettings | undefined;
    let defaultFolder = "";
    let input!: TextComponent;
    let saveTimer: number | undefined;
    let saveGeneration = 0;

    const scheduleSave = (): void => {
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      const scheduledGeneration = ++saveGeneration;
      saveTimer = window.setTimeout(() => {
        saveTimer = undefined;
        const savedFolder = defaultFolder;
        void this.settings.update((settings) => ({ ...settings, defaultFolder: savedFolder }))
          .then((updated) => {
            if (renderGeneration !== this.renderGeneration || scheduledGeneration !== saveGeneration) return;
            currentSettings = updated;
            statusSetting.setDesc("Default import folder saved.");
          })
          .catch(() => {
            if (renderGeneration !== this.renderGeneration || scheduledGeneration !== saveGeneration) return;
            statusSetting.setDesc("Could not save default import folder.");
            new Notice("Could not save default import folder.");
          });
      }, 300);
    };

    this.defaultFolderCleanup = (): void => {
      saveGeneration += 1;
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      saveTimer = undefined;
      this.defaultFolderSuggest?.close();
      this.defaultFolderSuggest = undefined;
    };

    setting.addText((text) => {
      input = text;
      text
        .setPlaceholder("Books")
        .setDisabled(true)
        .onChange((value) => {
          if (currentSettings === undefined || renderGeneration !== this.renderGeneration) return;
          defaultFolder = value;
          statusSetting.setDesc("Default import folder has unsaved changes.");
          scheduleSave();
        });
    });
    const folders = (this.appInstance as unknown as { readonly vault?: FolderSource }).vault;
    if (folders !== undefined) {
      this.defaultFolderSuggest = new FolderSuggest(this.appInstance, input.inputEl, folders, (value) => {
        defaultFolder = value;
        input.setValue(value);
        statusSetting.setDesc("Default import folder has unsaved changes.");
        scheduleSave();
      });
    }

    void this.settings.load().then((loaded) => {
      if (renderGeneration !== this.renderGeneration) return;
      currentSettings = loaded;
      defaultFolder = loaded.defaultFolder;
      input.setValue(loaded.defaultFolder).setDisabled(false);
      statusSetting.setDesc("Vault-relative folder used before any successful import.");
    }).catch(() => {
      if (renderGeneration !== this.renderGeneration) return;
      statusSetting.setDesc("Could not load import settings.");
      new Notice("Could not load import settings.");
    });
  }

  private renderDefaultFolder(renderGeneration: number): void {
    this.renderDefaultFolderSetting(new Setting(this.containerEl), renderGeneration);
  }

  private renderYandexOAuthSetup(setting: Setting): void {
    setting
      .setName("Yandex OAuth token")
      .setDesc("To get a Yandex OAuth token, authorize Yandex, copy the y0_... token from the browser URL, and paste it into the field.")
      .addButton((button) => button
        .setButtonText("Get Yandex OAuth token")
        .onClick(() => {
          this.openExternalUrl(YANDEX_OAUTH_URL);
        }));
  }

  private clearDefaultFolderEditing(): void {
    this.defaultFolderCleanup?.();
    this.defaultFolderCleanup = undefined;
  }

  private invalidateConnectionTest(providerId: string): number {
    const generation = (this.connectionTestGenerations.get(providerId) ?? 0) + 1;
    this.connectionTestGenerations.set(providerId, generation);
    return generation;
  }

  private isCurrentConnectionTest(providerId: string, testGeneration: number, renderGeneration: number): boolean {
    return this.renderGeneration === renderGeneration && this.connectionTestGenerations.get(providerId) === testGeneration;
  }

  private clearTemporaryCredentials(): void {
    this.temporaryCredentials.clear();
    for (const input of this.credentialInputs) input.setValue("");
    this.credentialInputs.length = 0;
  }
}
