import { describe, expect, it } from "vitest";

import { matchingFolderPaths } from "../../src/obsidian/folder-suggest";

describe("folder autocomplete", () => {
  it("returns matching nested vault-relative folders and excludes the root", () => {
    expect(matchingFolderPaths("Books/To", ["", "Books", "Books/To Read", "Archive"])).toEqual(["Books/To Read"]);
  });

  it("keeps unmatched typed paths available for free-form entry", () => {
    expect(matchingFolderPaths("Books/Unsorted", ["Books", "Archive"])).toEqual([]);
  });

  it("matches folder paths without making case-sensitive input mandatory", () => {
    expect(matchingFolderPaths("books", ["Books", "Archive"])).toEqual(["Books"]);
  });
});
