import {
  Notice,
  PluginSettingTab,
  Setting,
  type App,
  type ButtonComponent,
  type Plugin,
  type TextComponent,
} from "obsidian";

import type { ImportUseCase } from "../core/import";
import type { CredentialStorePort, ImportError, ImportSettings, SettingsRepositoryPort } from "../core/ports";
import type { ProviderRegistry } from "../core/registry";

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
  private readonly registry: ProviderRegistry;
  private readonly credentials: CredentialStorePort;
  private readonly imports: Pick<ImportUseCase, "testCredential">;
  private readonly settings: SettingsRepositoryPort;
  private readonly temporaryCredentials = new Map<string, string>();
  private readonly credentialInputs: TextComponent[] = [];
  private readonly connectionTestGenerations = new Map<string, number>();
  private renderGeneration = 0;

  constructor(
    app: App,
    plugin: Plugin,
    registry: ProviderRegistry,
    credentials: CredentialStorePort,
    imports: Pick<ImportUseCase, "testCredential">,
    settings: SettingsRepositoryPort,
  ) {
    super(app, plugin);
    this.registry = registry;
    this.credentials = credentials;
    this.imports = imports;
    this.settings = settings;
  }

  override display(): void {
    this.render();
  }

  render(): void {
    const renderGeneration = ++this.renderGeneration;
    this.clearTemporaryCredentials();
    this.containerEl.empty();
    this.renderDefaultFolder(renderGeneration);

    for (const provider of this.registry.all()) {
      let configured = false;
      try {
        configured = this.credentials.get(provider.id) !== null;
      } catch {
        // The fixed status below avoids exposing host or secret details.
      }

      const setting = new Setting(this.containerEl)
        .setName(provider.displayName)
        .setDesc(configured ? "Configured" : "Not configured");
      let input: TextComponent;
      let connectionButton!: ButtonComponent;

      setting.addText((text) => {
        input = text;
        this.credentialInputs.push(text);
        text.inputEl.type = "password";
        text.setPlaceholder(configured ? "Enter replacement credential" : "Enter credential");
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
  }

  override hide(): void {
    this.renderGeneration += 1;
    this.clearTemporaryCredentials();
    super.hide();
  }

  private renderDefaultFolder(renderGeneration: number): void {
    const setting = new Setting(this.containerEl)
      .setName("Default import folder")
      .setDesc("Loading import settings...");
    let currentSettings: ImportSettings | undefined;
    let defaultFolder = "";
    let input!: TextComponent;
    let saveButton!: ButtonComponent;

    setting.addText((text) => {
      input = text;
      text
        .setPlaceholder("Books")
        .setDisabled(true)
        .onChange((value) => {
          if (currentSettings === undefined || renderGeneration !== this.renderGeneration) return;
          defaultFolder = value;
          setting.setDesc("Default import folder has unsaved changes.");
        });
    });
    setting.addButton((button) => {
      saveButton = button;
      button
        .setButtonText("Save default folder")
        .setDisabled(true)
        .onClick(async () => {
          const previous = currentSettings;
          if (previous === undefined || renderGeneration !== this.renderGeneration) return;
          const savedFolder = defaultFolder;
          const updated: ImportSettings = { ...previous, defaultFolder: savedFolder };
          button.setDisabled(true);
          try {
            await this.settings.save(updated);
            if (renderGeneration !== this.renderGeneration) return;
            currentSettings = updated;
            setting.setDesc(defaultFolder === savedFolder
              ? "Default import folder saved."
              : "Default import folder has unsaved changes.");
          } catch {
            if (renderGeneration !== this.renderGeneration) return;
            setting.setDesc("Could not save default import folder.");
            new Notice("Could not save default import folder.");
          } finally {
            if (renderGeneration === this.renderGeneration) button.setDisabled(false);
          }
        });
    });

    void this.settings.load().then((loaded) => {
      if (renderGeneration !== this.renderGeneration) return;
      currentSettings = loaded;
      defaultFolder = loaded.defaultFolder;
      input.setValue(loaded.defaultFolder).setDisabled(false);
      saveButton.setDisabled(false);
      setting.setDesc("Vault-relative folder used before any successful import.");
    }).catch(() => {
      if (renderGeneration !== this.renderGeneration) return;
      setting.setDesc("Could not load import settings.");
      new Notice("Could not load import settings.");
    });
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
