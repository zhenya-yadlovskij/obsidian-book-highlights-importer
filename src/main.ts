import { Plugin } from "obsidian";

export default class BookHighlightsImporterPlugin extends Plugin {
  override onload(): Promise<void> {
    return Promise.resolve();
  }

  override onunload(): void {
    // Obsidian owns cleanup for resources registered by the plugin.
  }
}
