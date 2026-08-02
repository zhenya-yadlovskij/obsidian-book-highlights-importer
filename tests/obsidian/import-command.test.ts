import { describe, expect, it, vi } from "vitest";

import { registerImportBookHighlightsCommand } from "../../src/obsidian/import-command";

describe("import command registration", () => {
  it("registers one narrow command that opens the supplied wizard", () => {
    const commands: { id: string; name: string; callback?: () => void }[] = [];
    const openWizard = vi.fn();

    registerImportBookHighlightsCommand({
      addCommand: (command) => {
        commands.push(command);
      },
    }, openWizard);

    expect(commands.map(({ id, name }) => ({ id, name }))).toEqual([{
      id: "import-book-highlights",
      name: "Import Book Highlights",
    }]);
    commands[0]?.callback?.();
    expect(openWizard).toHaveBeenCalledOnce();
  });
});
