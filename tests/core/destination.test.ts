import { describe, expect, it } from "vitest";
import {
  chooseDestinationFolder,
  createDestination,
  normalizeVaultPath,
  sanitizeEditedFilename,
  sanitizeFilename,
} from "../../src/core/destination";

describe("destination policy", () => {
  it("uses the last successful folder before the configured default", () => {
    expect(chooseDestinationFolder({ defaultFolder: "Books", lastFolder: "Archive" })).toBe("Archive");
    expect(chooseDestinationFolder({ defaultFolder: "Books" })).toBe("Books");
  });

  it("normalizes safe vault-relative paths and rejects traversal", () => {
    expect(normalizeVaultPath("/Books\\Fiction/./Dune")).toEqual({ ok: true, value: "Books/Fiction/Dune" });
    expect(normalizeVaultPath("../outside").ok).toBe(false);
    expect(normalizeVaultPath("/outside/../../file").ok).toBe(false);
  });

  it("creates an editable sanitized author-title filename and destination", () => {
    expect(sanitizeFilename("Frank / Herbert", "Dune: The / Desert")).toBe("Frank - Herbert - Dune - The - Desert.md");
    const sanitized = sanitizeFilename("Frank\u0000 Herbert", "Dune\u0007");
    let hasControlCharacter = false;
    for (const character of sanitized) {
      const code = character.charCodeAt(0);
      if (code < 32 || code === 127) hasControlCharacter = true;
    }
    expect(hasControlCharacter).toBe(false);
    expect(createDestination("Books", "Frank - Herbert - Dune.md")).toEqual({
      ok: true,
      value: "Books/Frank - Herbert - Dune.md",
    });
    expect(createDestination("Books\u0000", "Dune.md").ok).toBe(false);
    expect(createDestination("Books", "Dune\u0000.md").ok).toBe(false);
  });

  it("sanitizes an edited filename before destination confirmation", () => {
    expect(sanitizeEditedFilename("  Dune: Part / One  ")).toBe("Dune - Part - One.md");
    expect(sanitizeEditedFilename("Dune.md")).toBe("Dune.md");
    expect(sanitizeEditedFilename("<>.md")).toBe("Untitled.md");
  });
});
