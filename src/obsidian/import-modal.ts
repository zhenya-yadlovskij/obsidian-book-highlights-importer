import { Modal, Setting, type App } from "obsidian";

import {
  createImportWizardController,
  type ImportWizardController,
  type ImportWizardDependencies,
  type ImportWizardState,
} from "../core/import-wizard";

export type ImportModalDependencies = Omit<ImportWizardDependencies, "onStateChange" | "onCancel">;

const groupName = (key: "in-progress" | "finished" | "unread-or-unknown"): string => {
  switch (key) {
    case "in-progress":
      return "In progress";
    case "finished":
      return "Finished";
    case "unread-or-unknown":
      return "Unread or unknown";
  }
};

const bookDescription = (authors: readonly string[]): string => authors.length === 0
  ? "Unknown author"
  : authors.join(", ");

export class ImportBookHighlightsModal extends Modal {
  private readonly controller: ImportWizardController;
  private opened = false;
  private renderedKind: ImportWizardState["kind"] | undefined;
  private bookResultsEl: HTMLElement | undefined;
  private readonly onClosed: (() => void) | undefined;

  constructor(app: App, dependencies: ImportModalDependencies, onClosed?: () => void) {
    super(app);
    this.onClosed = onClosed;
    this.controller = createImportWizardController({
      ...dependencies,
      onStateChange: (state) => {
        if (!this.opened) return;
        if (state.kind === "destination" && this.renderedKind === "destination") return;
        if (state.kind === "book" && this.renderedKind === "book" && this.bookResultsEl !== undefined) {
          this.renderBookResults(state);
          return;
        }
        this.render(state);
      },
    });
  }

  override onOpen(): void {
    this.opened = true;
    this.setTitle("Import Book Highlights");
    this.render(this.controller.getState());
  }

  override close(): void {
    if (this.controller.getState().kind === "importing") return;
    super.close();
  }

  closeForUnload(): void {
    this.opened = false;
    this.controller.cancelForUnload();
    super.close();
  }

  override onClose(): void {
    this.opened = false;
    const state = this.controller.getState();
    if (state.kind !== "complete" && state.kind !== "cancelled" && state.kind !== "importing") {
      this.controller.cancel();
    }
    this.contentEl.empty();
    this.onClosed?.();
  }

  private render(state: ImportWizardState): void {
    this.renderedKind = state.kind;
    this.bookResultsEl = undefined;
    this.contentEl.empty();
    this.contentEl.createEl("p", { text: "Provider > Book > Destination" });

    switch (state.kind) {
      case "provider":
        this.renderProvider(state);
        return;
      case "loading":
        this.renderLoading(state);
        return;
      case "book":
        this.renderBook(state);
        return;
      case "destination":
        this.renderDestination(state);
        return;
      case "importing":
        this.contentEl.createEl("p", { text: "Importing..." });
        this.contentEl.createEl("p", { text: "Keep this window open while the note update completes." });
        return;
      case "error":
        this.renderError(state);
        return;
      case "complete":
        this.renderComplete(state);
        return;
      case "cancelled":
        super.close();
    }
  }

  private renderProvider(state: Extract<ImportWizardState, { kind: "provider" }>): void {
    this.contentEl.createEl("h2", { text: "Choose a provider" });
    for (const provider of state.providers) {
      new Setting(this.contentEl)
        .setName(provider.displayName)
        .setDesc(provider.configured ? "Configured" : "Not configured")
        .addButton((button) => button
          .setButtonText("Select")
          .onClick(async () => this.controller.selectProvider(provider.id)));
    }
    this.addCancel();
  }

  private renderLoading(state: Extract<ImportWizardState, { kind: "loading" }>): void {
    const message = state.operation === "library"
      ? "Loading library..."
      : state.operation === "annotations"
        ? "Loading annotations..."
        : "Loading destination settings...";
    this.contentEl.createEl("p", { text: message });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Back").onClick(() => {
        this.controller.back();
      }))
      .addButton((button) => button.setButtonText("Cancel").onClick(() => {
        this.controller.cancel();
      }));
  }

  private renderBook(state: Extract<ImportWizardState, { kind: "book" }>): void {
    this.contentEl.createEl("h2", { text: "Choose one book" });
    new Setting(this.contentEl)
      .setName("Search books")
      .addSearch((search) => search
        .setPlaceholder("Title or author")
        .setValue(state.query)
        .onChange((value) => {
          this.controller.search(value);
        }));

    this.bookResultsEl = this.contentEl.createEl("div");
    this.renderBookResults(state);
    this.addBackAndCancel();
  }

  private renderBookResults(state: Extract<ImportWizardState, { kind: "book" }>): void {
    const container = this.bookResultsEl;
    if (container === undefined) return;
    container.empty();
    if (state.message !== undefined) container.createEl("p", { text: state.message });
    if (state.message === undefined && state.groups.length === 0) {
      container.createEl("p", { text: "No books match this search." });
    }
    for (const group of state.groups) {
      new Setting(container).setName(groupName(group.key)).setHeading();
      for (const book of group.books) {
        new Setting(container)
          .setName(book.title)
          .setDesc(bookDescription(book.authors))
          .addButton((button) => button
            .setButtonText("Choose book")
            .setCta()
            .onClick(async () => this.controller.selectBook(book.bookId)));
      }
    }
  }

  private renderDestination(state: Extract<ImportWizardState, { kind: "destination" }>): void {
    this.contentEl.createEl("h2", { text: "Choose a destination" });
    let folder = state.folder;
    let filename = state.filename;
    new Setting(this.contentEl)
      .setName("Folder")
      .setDesc("Vault-relative folder")
      .addText((text) => text.setValue(folder).onChange((value) => {
        folder = value;
        this.controller.updateDestination(folder, filename);
      }));
    new Setting(this.contentEl)
      .setName("Filename")
      .setDesc("Invalid filename characters are replaced before import.")
      .addText((text) => text.setValue(filename).onChange((value) => {
        filename = value;
        this.controller.updateDestination(folder, filename);
      }));
    if (state.annotationCount !== undefined) {
      new Setting(this.contentEl).setName("Importable annotations").setDesc(String(state.annotationCount));
    }
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Back").onClick(() => {
        this.controller.back();
      }))
      .addButton((button) => button.setButtonText("Import").setCta().onClick(async () => {
        await this.controller.import();
      }))
      .addButton((button) => button.setButtonText("Cancel").onClick(() => {
        this.controller.cancel();
      }));
  }

  private renderError(state: Extract<ImportWizardState, { kind: "error" }>): void {
    this.contentEl.createEl("h2", { text: "Import could not continue" });
    this.contentEl.createEl("p", { text: state.message });
    const actions = new Setting(this.contentEl);
    if (state.canRetry) {
      actions.addButton((button) => button.setButtonText("Retry").setCta().onClick(async () => this.controller.retry()));
    }
    actions
      .addButton((button) => button.setButtonText("Back").onClick(() => {
        this.controller.back();
      }))
      .addButton((button) => button.setButtonText("Cancel").onClick(() => {
        this.controller.cancel();
      }));
  }

  private renderComplete(state: Extract<ImportWizardState, { kind: "complete" }>): void {
    const noun = state.annotationCount === 1 ? "annotation" : "annotations";
    this.contentEl.createEl("h2", { text: "Import complete" });
    this.contentEl.createEl("p", { text: `Imported ${String(state.annotationCount)} ${noun}.` });
    new Setting(this.contentEl).setName("Destination").setDesc(state.path);
    for (const warning of state.warnings) this.contentEl.createEl("p", { text: warning });
    const actions = new Setting(this.contentEl);
    if (state.canRetryOpen) {
      actions.addButton((button) => button.setButtonText("Retry opening note").onClick(async () => this.controller.retryOpen()));
    }
    actions.addButton((button) => button.setButtonText("Done").setCta().onClick(() => {
        this.close();
      }));
  }

  private addBackAndCancel(): void {
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Back").onClick(() => {
        this.controller.back();
      }))
      .addButton((button) => button.setButtonText("Cancel").onClick(() => {
        this.controller.cancel();
      }));
  }

  private addCancel(): void {
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Cancel").onClick(() => {
        this.controller.cancel();
      }));
  }
}
