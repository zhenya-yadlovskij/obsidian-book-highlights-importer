import { AbstractInputSuggest, type App } from "obsidian";

import { matchingFolderPaths, type FolderSource } from "./folder-suggest";

export type { FolderSource } from "./folder-suggest";

export class FolderSuggest extends AbstractInputSuggest<string> {
  private readonly folders: FolderSource;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    folders: FolderSource,
    onSelectFolder: (folder: string) => void,
  ) {
    super(app, inputEl);
    this.folders = folders;
    this.onSelect(onSelectFolder);
  }

  protected getSuggestions(query: string): string[] {
    return [...matchingFolderPaths(query, this.folders.getAllFolders(false).map((folder) => folder.path))];
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.createDiv({ text: value });
  }
}
