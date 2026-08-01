import { Plugin } from "obsidian";
import { YandexBookClient } from "yandex-book-api-ts";

import { createYandexRuntimeHarness } from "./compatibility/yandex-runtime";
import { RuntimeCompatibilityModal } from "./obsidian/runtime-compatibility-modal";

export default class BookHighlightsImporterPlugin extends Plugin {
  override onload(): Promise<void> {
    const harness = createYandexRuntimeHarness(
      this.app.secretStorage,
      (credential) => new YandexBookClient(credential),
    );
    this.addCommand({
      id: "open-runtime-compatibility-harness",
      name: "Open runtime compatibility harness",
      callback: () => {
        new RuntimeCompatibilityModal(this.app, harness).open();
      },
    });
    return Promise.resolve();
  }

  override onunload(): void {
    // Obsidian owns cleanup for resources registered by the plugin.
  }
}
