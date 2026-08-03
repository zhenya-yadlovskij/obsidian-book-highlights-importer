import type { App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { YandexRuntimeHarness, YandexRuntimeResult } from "../../src/compatibility/yandex-runtime";

interface FakeButton {
  text: string;
  disabled: boolean;
  readonly disabledHistory: boolean[];
  click(): Promise<void>;
}

interface FakeText {
  readonly inputEl: { type: string };
  value: string;
  change(value: string): Promise<void>;
}

class FakeElement {
  text = "";
  readonly children: FakeElement[] = [];

  constructor(readonly tag = "div") {}

  empty(): void {
    this.children.length = 0;
  }

  createEl(tag: string, options?: { text?: string }): FakeElement {
    const child = new FakeElement(tag);
    child.text = options?.text ?? "";
    this.children.push(child);
    return child;
  }

  setText(value: string): void {
    this.text = value;
  }
}

class FakeTextComponent implements FakeText {
  readonly inputEl = { type: "text" };
  value = "";
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

interface FakeSetting {
  name: string;
  readonly buttons: FakeButton[];
  readonly texts: FakeText[];
}

const { notices, settings } = vi.hoisted(() => ({
  notices: [] as string[],
  settings: [] as FakeSetting[],
}));

vi.mock("obsidian", () => ({
  Modal: class Modal {
    readonly contentEl = new FakeElement();
    title = "";

    setTitle(value: string): void {
      this.title = value;
    }

    open(): void {
      (this as { onOpen?: () => void }).onOpen?.();
    }

    close(): void {
      (this as { onClose?: () => void }).onClose?.();
    }
  },
  Notice: class Notice {
    readonly message: string;

    constructor(message: string) {
      this.message = message;
      notices.push(message);
    }
  },
  Setting: class Setting implements FakeSetting {
    name = "";
    readonly buttons: FakeButton[] = [];
    readonly texts: FakeText[] = [];

    constructor() {
      settings.push(this);
    }

    setName(value: string): this {
      this.name = value;
      return this;
    }

    setDesc(): this {
      return this;
    }

    addText(callback: (text: FakeTextComponent) => void): this {
      const text = new FakeTextComponent();
      this.texts.push(text);
      callback(text);
      return this;
    }

    addButton(callback: (button: FakeButtonComponent) => void): this {
      const button = new FakeButtonComponent();
      this.buttons.push(button);
      callback(button);
      return this;
    }
  },
}));

import { RuntimeCompatibilityModal } from "../../src/obsidian/runtime-compatibility-modal";

const success: YandexRuntimeResult = {
  ok: true,
  library: { count: 0, states: [] },
  quotes: {
    count: 0,
    importableCount: 0,
    structuralStatus: "valid",
  },
};

const settingNamed = (name: string): FakeSetting => {
  const setting = settings.find((candidate) => candidate.name === name);
  if (setting === undefined) throw new Error(`Missing setting: ${name}`);
  return setting;
};

const harnessWithRun = (run: () => Promise<YandexRuntimeResult>): YandexRuntimeHarness => ({
  isConfigured: () => true,
  saveCredential: vi.fn(),
  clearCredential: vi.fn(),
  run,
});

describe("runtime compatibility modal lifecycle", () => {
  beforeEach(() => {
    notices.length = 0;
    settings.length = 0;
  });

  it("discards a deferred compatibility result after close", async () => {
    let resolveRun!: (result: YandexRuntimeResult) => void;
    const runResult = new Promise<YandexRuntimeResult>((resolve) => {
      resolveRun = resolve;
    });
    const onClosed = vi.fn();
    const modal = new RuntimeCompatibilityModal(
      {} as App,
      harnessWithRun(() => runResult),
      onClosed,
    );
    modal.open();
    const input = settingNamed("Temporary Yandex OAuth token").texts[0];
    const runButton = settingNamed("Package compatibility").buttons[0];
    const resultEl = (modal.contentEl as unknown as FakeElement).children.find((element) => element.tag === "pre");
    if (input === undefined || runButton === undefined || resultEl === undefined) throw new Error("Missing controls");
    await input.change("temporary-token");

    const checking = runButton.click();
    expect(resultEl.text).toBe("Running compatibility check...");
    modal.close();
    expect(onClosed).toHaveBeenCalledOnce();
    expect((modal as unknown as { credential: string }).credential).toBe("");
    expect((modal.contentEl as unknown as FakeElement).children).toEqual([]);

    resolveRun(success);
    await checking;
    expect(resultEl.text).toBe("Running compatibility check...");
    expect(notices).toEqual([]);
    expect(runButton.disabledHistory).toEqual([true]);
  });

  it("renders and re-enables after a current in-view result", async () => {
    const modal = new RuntimeCompatibilityModal(
      {} as App,
      harnessWithRun(() => Promise.resolve(success)),
    );
    modal.open();
    const runButton = settingNamed("Package compatibility").buttons[0];
    const resultEl = (modal.contentEl as unknown as FakeElement).children.find((element) => element.tag === "pre");
    if (runButton === undefined || resultEl === undefined) throw new Error("Missing controls");

    await runButton.click();

    expect(resultEl.text).toContain('"ok": true');
    expect(notices).toEqual(["Compatibility check completed."]);
    expect(runButton.disabledHistory).toEqual([true, false]);
  });
});
