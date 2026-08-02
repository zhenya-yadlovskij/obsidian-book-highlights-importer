import { Plugin, requestUrl } from "obsidian";

import { createYandexRuntimeHarness } from "./compatibility/yandex-runtime";
import { createCoreComposition } from "./core/composition";
import { createObsidianCredentialStore } from "./obsidian/credential-store";
import { registerImportBookHighlightsCommand } from "./obsidian/import-command";
import { ImportBookHighlightsModal } from "./obsidian/import-modal";
import { createObsidianNoteRepository } from "./obsidian/note-repository";
import { BookHighlightsSettingsTab } from "./obsidian/provider-settings-tab";
import { RuntimeCompatibilityModal } from "./obsidian/runtime-compatibility-modal";
import { createObsidianSettingsRepository } from "./obsidian/settings-repository";
import { createObsidianYandexClient } from "./obsidian/yandex-client";
import { createYandexBooksProvider } from "./providers/yandex";

export default class BookHighlightsImporterPlugin extends Plugin {
  private readonly openModals = new Map<object, () => void>();

  override onload(): Promise<void> {
    const createYandexClient = (credential: string): ReturnType<typeof createObsidianYandexClient> =>
      createObsidianYandexClient(credential, requestUrl);
    const harness = createYandexRuntimeHarness(
      this.app.secretStorage,
      createYandexClient,
    );
    const credentials = createObsidianCredentialStore(this.app.secretStorage);
    const settings = createObsidianSettingsRepository(this);
    const notes = createObsidianNoteRepository(this.app.vault, this.app.workspace);
    const composition = createCoreComposition(
      [createYandexBooksProvider(createYandexClient)],
      { credentials, settings, notes },
    );

    this.addSettingTab(new BookHighlightsSettingsTab(
      this.app,
      this,
      composition.registry,
      credentials,
      composition.importUseCase,
      settings,
    ));
    this.addCommand({
      id: "open-runtime-compatibility-harness",
      name: "Open runtime compatibility harness",
      callback: () => {
        const modal = new RuntimeCompatibilityModal(this.app, harness, () => {
          this.openModals.delete(modal);
        });
        this.openModals.set(modal, () => {
          modal.close();
        });
        modal.open();
      },
    });
    registerImportBookHighlightsCommand(this, () => {
      const modal = new ImportBookHighlightsModal(this.app, {
        registry: composition.registry,
        credentials,
        settings,
        imports: composition.importUseCase,
        openNote: notes.open,
      }, () => {
        this.openModals.delete(modal);
      });
      this.openModals.set(modal, () => {
        modal.closeForUnload();
      });
      modal.open();
    });
    return Promise.resolve();
  }

  override onunload(): void {
    const closeActions = [...this.openModals.values()];
    this.openModals.clear();
    for (const close of closeActions) close();
  }
}
