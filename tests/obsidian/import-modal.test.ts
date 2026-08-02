import type { App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createImportUseCase, type ImportUseCase } from "../../src/core/import";
import { createBookAnnotation, createImportSnapshot, createProviderBook } from "../../src/core/models";
import type { BookAnnotation } from "../../src/core/models";
import type { ImportSettings, ProviderResult, ReadingProviderPort } from "../../src/core/ports";
import { createProviderRegistry } from "../../src/core/registry";

interface FakeButton {
  text: string;
  click(): Promise<void>;
}

interface FakeText {
  value: string;
  readonly inputEl: {
    focused: boolean;
    focus(): void;
  };
  change(value: string): Promise<void>;
}

interface FakeSetting {
  name: string;
  description: string;
  readonly container: FakeElement;
  readonly buttons: FakeButton[];
  readonly texts: FakeText[];
  readonly searches: FakeText[];
}

class FakeElement {
  text = "";
  readonly children: FakeElement[] = [];

  constructor(readonly parent?: FakeElement) {}

  empty(): void {
    for (let index = renderedSettings.length - 1; index >= 0; index -= 1) {
      const setting = renderedSettings[index];
      if (setting !== undefined && this.contains(setting.container)) renderedSettings.splice(index, 1);
    }
    this.children.length = 0;
  }

  createEl(_tag: string, options?: { text?: string }): FakeElement {
    const child = new FakeElement(this);
    child.text = options?.text ?? "";
    this.children.push(child);
    return child;
  }

  setText(value: string): void {
    this.text = value;
  }

  querySelector(): null {
    return null;
  }

  private contains(element: FakeElement): boolean {
    return element === this || this.children.some((child) => child.contains(element));
  }
}

class FakeTextComponent implements FakeText {
  value = "";
  readonly inputEl = {
    focused: false,
    focus: (): void => {
      this.inputEl.focused = true;
    },
    setSelectionRange: vi.fn(),
  };
  private onChangeCallback: (value: string) => void | Promise<void> = () => undefined;

  setPlaceholder(): this {
    return this;
  }

  setValue(value: string): this {
    this.value = value;
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

class FakeButtonComponent implements FakeButton {
  text = "";
  private onClickCallback: () => void | Promise<void> = () => undefined;

  setButtonText(value: string): this {
    this.text = value;
    return this;
  }

  setCta(): this {
    return this;
  }

  setWarning(): this {
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

const renderedSettings: FakeSetting[] = [];

vi.mock("obsidian", () => ({
  Modal: class Modal {
    readonly contentEl = new FakeElement();
    readonly modalEl = new FakeElement();
    title = "";
    closed = false;

    setTitle(value: string): void {
      this.title = value;
    }

    open(): void {
      (this as { onOpen?: () => void }).onOpen?.();
    }

    close(): void {
      this.closed = true;
      (this as { onClose?: () => void }).onClose?.();
    }
  },
  Setting: class Setting implements FakeSetting {
    name = "";
    description = "";
    readonly buttons: FakeButton[] = [];
    readonly texts: FakeText[] = [];
    readonly searches: FakeText[] = [];

    constructor(readonly container: FakeElement) {
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

    setHeading(): this {
      return this;
    }

    addButton(callback: (button: FakeButtonComponent) => void): this {
      const button = new FakeButtonComponent();
      this.buttons.push(button);
      callback(button);
      return this;
    }

    addText(callback: (text: FakeTextComponent) => void): this {
      const text = new FakeTextComponent();
      this.texts.push(text);
      callback(text);
      return this;
    }

    addSearch(callback: (search: FakeTextComponent) => void): this {
      const search = new FakeTextComponent();
      this.searches.push(search);
      callback(search);
      return this;
    }
  },
}));

import type { ImportWizardController } from "../../src/core/import-wizard";
import { ImportBookHighlightsModal } from "../../src/obsidian/import-modal";

const selectedBook = createProviderBook({
  providerId: "provider",
  bookId: "dune",
  title: "Dune",
  authors: ["Frank Herbert"],
  status: "finished",
});

const otherBook = createProviderBook({
  providerId: "provider",
  bookId: "foundation",
  title: "Foundation",
  authors: ["Isaac Asimov"],
  status: "finished",
});

const provider: ReadingProviderPort = {
  id: "provider",
  displayName: "Provider",
  annotationFetch: "early",
  testCredential: vi.fn(),
  listBooks: vi.fn(),
  fetchAnnotations: vi.fn(),
};

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

const buttonNamed = (name: string): FakeButton => {
  const button = renderedSettings.flatMap((setting) => setting.buttons).find((candidate) => candidate.text === name);
  if (button === undefined) throw new Error(`Missing button: ${name}`);
  return button;
};

describe("import modal", () => {
  beforeEach(() => {
    renderedSettings.length = 0;
  });

  it("filters incrementally without replacing the focused search control", async () => {
    const modal = new ImportBookHighlightsModal({} as App, {
      registry: createProviderRegistry([provider]),
      credentials: { get: (): string => "configured" },
      settings: { load: (): Promise<ImportSettings> => Promise.resolve({ defaultFolder: "Books" }) },
      imports: {
        loadLibrary: (): ReturnType<ImportUseCase["loadLibrary"]> => Promise.resolve({
          ok: true,
          value: [selectedBook, otherBook],
        }),
        prepareSnapshot: vi.fn(),
        execute: vi.fn(),
      },
      openNote: vi.fn(() => Promise.resolve()),
    });
    modal.open();
    await buttonNamed("Select").click();
    const search = settingNamed("Search books").searches[0];
    if (search === undefined) throw new Error("Missing search control");
    search.inputEl.focus();

    await search.change("d");
    expect(settingNamed("Search books").searches[0]).toBe(search);
    await search.change("du");

    expect(settingNamed("Search books").searches[0]).toBe(search);
    expect(search.inputEl.focused).toBe(true);
    expect(renderedSettings.map((setting) => setting.name)).toContain("Dune");
    expect(renderedSettings.map((setting) => setting.name)).not.toContain("Foundation");
  });

  it("drives provider, book, destination, review, importing, and completion with native controls", async () => {
    let resolveImport!: (value: {
      readonly ok: true;
      readonly value: {
        readonly path: string;
        readonly annotationCount: number;
        readonly warnings: readonly [
          { readonly category: "post-commit-warning"; readonly kind: "open-note" },
        ];
      };
    }) => void;
    const importResult = new Promise<Parameters<typeof resolveImport>[0]>((resolve) => {
      resolveImport = resolve;
    });
    const execute = vi.fn(() => importResult);
    const openNote = vi.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined);
    const modal = new ImportBookHighlightsModal({} as App, {
      registry: createProviderRegistry([provider]),
      credentials: { get: (): string => "configured" },
      settings: { load: (): Promise<ImportSettings> => Promise.resolve({ defaultFolder: "Books" }) },
      imports: {
        loadLibrary: (): ReturnType<ImportUseCase["loadLibrary"]> => Promise.resolve({ ok: true, value: [selectedBook] }),
        prepareSnapshot: (): ReturnType<ImportUseCase["prepareSnapshot"]> => Promise.resolve({
          ok: true,
          value: createImportSnapshot({
            book: selectedBook,
            annotations: [createBookAnnotation({ text: "Highlight", inputIndex: 0 })],
          }),
        }),
        execute,
      },
      openNote,
    });

    modal.open();
    expect((modal as unknown as { title: string }).title).toBe("Import Book Highlights");
    expect((modal.contentEl as unknown as FakeElement).children.map((child) => child.text)).toContain(
      "Provider > Book > Destination > Review",
    );
    expect(settingNamed("Provider").description).toBe("Configured");

    await buttonNamed("Select").click();
    expect(settingNamed("Search books").searches).toHaveLength(1);
    expect(settingNamed("Dune").description).toBe("Frank Herbert");

    await buttonNamed("Choose book").click();
    expect(settingNamed("Folder").texts[0]?.value).toBe("Books");
    expect(settingNamed("Filename").texts[0]?.value).toBe("Frank Herbert - Dune.md");

    await settingNamed("Filename").texts[0]?.change("Dune: Notes");
    await buttonNamed("Review").click();
    expect(execute).not.toHaveBeenCalled();
    expect(settingNamed("Annotations").description).toBe("1");

    const confirm = buttonNamed("Import").click();
    await Promise.resolve();
    expect(renderedSettings.flatMap((setting) => setting.buttons).map((button) => button.text)).not.toContain("Cancel");
    expect((modal.contentEl as unknown as FakeElement).children.map((child) => child.text)).toContain("Importing...");
    modal.close();
    expect((modal as unknown as { closed: boolean }).closed).toBe(false);

    resolveImport({
      ok: true,
      value: {
        path: "Books/Dune - Notes.md",
        annotationCount: 1,
        warnings: [{ category: "post-commit-warning", kind: "open-note" }],
      },
    });
    await confirm;
    expect((modal.contentEl as unknown as FakeElement).children.map((child) => child.text)).toContain(
      "Imported 1 annotation.",
    );
    expect((modal.contentEl as unknown as FakeElement).children.map((child) => child.text)).toContain(
      "The note was imported, but Obsidian could not open it. Open it from the vault or retry opening it.",
    );
    await buttonNamed("Retry opening note").click();
    expect(openNote).toHaveBeenCalledWith("Books/Dune - Notes.md");
    expect(execute).toHaveBeenCalledOnce();
    expect(renderedSettings.flatMap((setting) => setting.buttons).map((button) => button.text)).not.toContain(
      "Retry opening note",
    );
    expect((modal.contentEl as unknown as FakeElement).children.map((child) => child.text)).not.toContain(
      "The note was imported, but Obsidian could not open it. Open it from the vault or retry opening it.",
    );
  });

  it("renders fixed safe errors with retry, Back, and Cancel controls", async () => {
    const modal = new ImportBookHighlightsModal({} as App, {
      registry: createProviderRegistry([provider]),
      credentials: { get: (): string => "configured" },
      settings: { load: (): Promise<ImportSettings> => Promise.resolve({ defaultFolder: "Books" }) },
      imports: {
        loadLibrary: (): ReturnType<ImportUseCase["loadLibrary"]> => Promise.resolve({
          ok: false,
          error: { category: "provider-unavailable", providerId: "provider" },
        }),
        prepareSnapshot: vi.fn(),
        execute: vi.fn(),
      },
      openNote: vi.fn(() => Promise.resolve()),
    });
    modal.open();

    await buttonNamed("Select").click();

    expect((modal.contentEl as unknown as FakeElement).children.map((child) => child.text)).toContain(
      "The provider is unavailable. Check your connection and retry.",
    );
    expect(renderedSettings.flatMap((setting) => setting.buttons).map((button) => button.text)).toEqual([
      "Retry",
      "Back",
      "Cancel",
    ]);
  });

  it("cancels pending pre-confirmation work when forced closed for unload", async () => {
    let resolveLibrary!: (value: Awaited<ReturnType<ImportUseCase["loadLibrary"]>>) => void;
    const library = new Promise<Awaited<ReturnType<ImportUseCase["loadLibrary"]>>>((resolve) => {
      resolveLibrary = resolve;
    });
    const onClosed = vi.fn();
    const modal = new ImportBookHighlightsModal({} as App, {
      registry: createProviderRegistry([provider]),
      credentials: { get: (): string => "configured" },
      settings: { load: (): Promise<ImportSettings> => Promise.resolve({ defaultFolder: "Books" }) },
      imports: {
        loadLibrary: (): ReturnType<ImportUseCase["loadLibrary"]> => library,
        prepareSnapshot: vi.fn(),
        execute: vi.fn(),
      },
      openNote: vi.fn(() => Promise.resolve()),
    }, onClosed);
    modal.open();
    const loading = buttonNamed("Select").click();
    await Promise.resolve();

    modal.closeForUnload();
    expect((modal as unknown as { closed: boolean }).closed).toBe(true);
    expect(onClosed).toHaveBeenCalledOnce();
    expect((modal as unknown as { controller: ImportWizardController }).controller.getState()).toEqual({ kind: "cancelled" });

    resolveLibrary({ ok: true, value: [selectedBook] });
    await loading;
    expect((modal as unknown as { controller: ImportWizardController }).controller.getState()).toEqual({ kind: "cancelled" });
    expect((modal.contentEl as unknown as FakeElement).children).toEqual([]);
  });

  it("force unload cancels a deferred confirmed import before note or post-commit operations", async () => {
    const annotations = deferred<ProviderResult<readonly BookAnnotation[]>>();
    const deferredProvider: ReadingProviderPort = {
      ...provider,
      annotationFetch: "deferred",
      listBooks: () => Promise.resolve({ ok: true, value: [selectedBook] }),
      fetchAnnotations: vi.fn(() => annotations.promise),
    };
    const load = vi.fn(() => Promise.resolve({ defaultFolder: "Books" }));
    const save = vi.fn(() => Promise.resolve());
    const notes = {
      inspect: vi.fn(() => Promise.resolve({ kind: "missing" as const })),
      create: vi.fn(() => Promise.resolve()),
      process: vi.fn(() => Promise.resolve()),
      open: vi.fn(() => Promise.resolve()),
    };
    const imports = createImportUseCase({
      credentials: { get: (): string => "configured" },
      settings: { load, save },
      notes,
    });
    const onClosed = vi.fn();
    const modal = new ImportBookHighlightsModal({} as App, {
      registry: createProviderRegistry([deferredProvider]),
      credentials: { get: (): string => "configured" },
      settings: { load },
      imports,
      openNote: notes.open,
    }, onClosed);
    modal.open();
    const controller = (modal as unknown as { controller: ImportWizardController }).controller;
    await controller.selectProvider("provider");
    await controller.selectBook("dune");
    controller.review();
    const importing = controller.confirm();
    expect(controller.getState()).toMatchObject({ kind: "importing" });
    await vi.waitFor(() => {
      expect(deferredProvider.fetchAnnotations).toHaveBeenCalledOnce();
    });
    const settingsLoadsBeforeUnload = load.mock.calls.length;

    modal.close();
    expect((modal as unknown as { closed: boolean }).closed).toBe(false);
    modal.closeForUnload();
    expect((modal as unknown as { closed: boolean }).closed).toBe(true);
    expect(onClosed).toHaveBeenCalledOnce();

    annotations.resolve({ ok: true, value: [createBookAnnotation({ text: "Highlight", inputIndex: 0 })] });
    await importing;
    expect(controller.getState()).toEqual({ kind: "cancelled" });
    expect(notes.inspect).not.toHaveBeenCalled();
    expect(notes.create).not.toHaveBeenCalled();
    expect(notes.process).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(settingsLoadsBeforeUnload);
    expect(notes.open).not.toHaveBeenCalled();
    expect((modal.contentEl as unknown as FakeElement).children).toEqual([]);
  });
});
