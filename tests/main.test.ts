import type { App, PluginManifest } from "obsidian";
import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  Plugin: class Plugin {
    readonly app = null;
  },
}));

import BookHighlightsImporterPlugin from "../src/main";

const createPlugin = (): BookHighlightsImporterPlugin =>
  new BookHighlightsImporterPlugin({} as App, {} as PluginManifest);

describe("BookHighlightsImporterPlugin lifecycle", () => {
  it("loads without requiring provider or UI behavior", async () => {
    await expect(createPlugin().onload()).resolves.toBeUndefined();
  });

  it("unloads cleanly", () => {
    expect(() => {
      createPlugin().onunload();
    }).not.toThrow();
  });
});
