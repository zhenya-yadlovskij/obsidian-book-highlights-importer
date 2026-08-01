import type { App, PluginManifest } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { openedModals, registeredCommands } = vi.hoisted(() => ({
  openedModals: [] as unknown[],
  registeredCommands: [] as { id: string; name: string; callback?: () => void }[],
}));

vi.mock("obsidian", () => ({
  Plugin: class Plugin {
    readonly app: App;

    constructor(app: App) {
      this.app = app;
    }

    addCommand(command: { id: string; name: string; callback?: () => void }): void {
      registeredCommands.push(command);
    }
  },
  Modal: class Modal {
    constructor(readonly app: App) {}

    open(): void {
      openedModals.push(this);
    }
  },
  Notice: class Notice {
    constructor(readonly message: string) {}
  },
  Setting: class Setting {
    constructor(readonly container: HTMLElement) {}
  },
  requestUrl: vi.fn(),
}));

import BookHighlightsImporterPlugin from "../src/main";

const createPlugin = (): BookHighlightsImporterPlugin =>
  new BookHighlightsImporterPlugin({
    secretStorage: {
      getSecret: vi.fn().mockReturnValue(null),
      setSecret: vi.fn(),
    },
  } as unknown as App, {} as PluginManifest);

describe("BookHighlightsImporterPlugin lifecycle", () => {
  beforeEach(() => {
    openedModals.length = 0;
    registeredCommands.length = 0;
  });

  it("registers the runtime compatibility harness without making a provider request", async () => {
    await expect(createPlugin().onload()).resolves.toBeUndefined();

    expect(registeredCommands.map(({ id, name }) => ({ id, name }))).toEqual([{
      id: "open-runtime-compatibility-harness",
      name: "Open runtime compatibility harness",
    }]);
  });

  it("opens one compatibility modal from the command", async () => {
    await createPlugin().onload();

    registeredCommands[0]?.callback?.();

    expect(openedModals).toHaveLength(1);
  });

  it("unloads cleanly", () => {
    expect(() => {
      createPlugin().onunload();
    }).not.toThrow();
  });
});
