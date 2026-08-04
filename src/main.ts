import { Plugin, requestUrl } from "obsidian";

import { createCoreComposition } from "./core/composition";
import { createObsidianCredentialStore } from "./obsidian/credential-store";
import { registerImportBookHighlightsCommand } from "./obsidian/import-command";
import { ImportBookHighlightsModal } from "./obsidian/import-modal";
import { createObsidianNoteRepository } from "./obsidian/note-repository";
import { BookHighlightsSettingsTab } from "./obsidian/provider-settings-tab";
import { createObsidianSettingsRepository } from "./obsidian/settings-repository";
import { createObsidianYandexClient } from "./obsidian/yandex-client";
import { createYandexBooksProvider } from "./providers/yandex";

export default class BookHighlightsImporterPlugin extends Plugin {
  private readonly openModals = new Map<object, () => void>();

  override onload(): Promise<void> {
    const createYandexClient = (credential: string): ReturnType<typeof createObsidianYandexClient> =>
      createObsidianYandexClient(credential, requestUrl);
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
