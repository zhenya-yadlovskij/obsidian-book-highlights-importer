import { describe, expect, it, vi } from "vitest";

import { createObsidianNoteRepository } from "../../src/obsidian/note-repository";

interface FakeFile {
  readonly path: string;
}

const file: FakeFile = { path: "Books/Dune.md" };

describe("Obsidian note repository", () => {
  it("inspects missing files, note candidates, and folder conflicts", async () => {
    const getFileByPath = vi.fn<(path: string) => FakeFile | null>()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(file)
      .mockReturnValueOnce(null);
    const getAbstractFileByPath = vi.fn<(path: string) => object | null>()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ path: "Books" });
    const repository = createObsidianNoteRepository({
      getFileByPath,
      getAbstractFileByPath,
      createFolder: vi.fn(),
      create: vi.fn(),
      process: vi.fn(),
    }, { getLeaf: vi.fn() });

    await expect(repository.inspect("Missing.md")).resolves.toEqual({ kind: "missing" });
    await expect(repository.inspect("/Books\\Dune.md")).resolves.toEqual({ kind: "managed" });
    await expect(repository.inspect("Books")).resolves.toEqual({ kind: "conflict" });
    expect(getFileByPath.mock.calls).toEqual([["Missing.md"], ["Books/Dune.md"], ["Books"]]);
  });

  it("rejects unsafe or empty file paths before touching the vault", async () => {
    const getFileByPath = vi.fn<(path: string) => FakeFile | null>();
    const getAbstractFileByPath = vi.fn<(path: string) => object | null>();
    const create = vi.fn();
    const process = vi.fn();
    const getLeaf = vi.fn();
    const repository = createObsidianNoteRepository(
      { getFileByPath, getAbstractFileByPath, createFolder: vi.fn(), create, process },
      { getLeaf },
    );

    await expect(repository.inspect("../outside.md")).rejects.toThrow("Unsafe vault file path");
    await expect(repository.create("", "content")).rejects.toThrow("Unsafe vault file path");
    await expect(repository.process("Books\u0000/Dune.md", (current) => current)).rejects.toThrow("Unsafe vault file path");
    await expect(repository.open("../outside.md")).rejects.toThrow("Unsafe vault file path");
    expect(getFileByPath).not.toHaveBeenCalled();
    expect(getAbstractFileByPath).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
    expect(getLeaf).not.toHaveBeenCalled();
  });

  it("creates complete content once at the normalized path", async () => {
    const create = vi.fn<(path: string, content: string) => Promise<FakeFile>>().mockResolvedValue(file);
    const repository = createObsidianNoteRepository({
      getFileByPath: vi.fn(),
      getAbstractFileByPath: vi.fn(),
      createFolder: vi.fn(),
      create,
      process: vi.fn(),
    }, { getLeaf: vi.fn() });

    await repository.create("/Books\\Dune.md", "complete note");

    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith("Books/Dune.md", "complete note");
  });

  it("creates missing folder segments in normalized order", async () => {
    const folders = new Set<string>();
    const createFolder = vi.fn<(path: string) => Promise<object>>().mockImplementation((path) => {
      folders.add(path);
      return Promise.resolve({ path });
    });
    const repository = createObsidianNoteRepository({
      getFileByPath: vi.fn((path: string) => path.endsWith(".md") ? file : null),
      getAbstractFileByPath: vi.fn((path: string) => folders.has(path) ? { path } : null),
      createFolder,
      create: vi.fn(),
      process: vi.fn(),
    }, { getLeaf: vi.fn() });

    await repository.ensureFolder("/Books\\To Read");

    expect(createFolder).toHaveBeenCalledWith("Books");
    expect(createFolder).toHaveBeenCalledWith("Books/To Read");
    expect(createFolder).toHaveBeenCalledTimes(2);
  });

  it("accepts an existing folder and rejects a file occupying a folder path", async () => {
    const createFolder = vi.fn<(path: string) => Promise<object>>().mockResolvedValue({});
    const repository = createObsidianNoteRepository({
      getFileByPath: vi.fn((path: string) => path === "Books" ? file : null),
      getAbstractFileByPath: vi.fn((path: string) => path === "Archive" ? { path } : null),
      createFolder,
      create: vi.fn(),
      process: vi.fn(),
    }, { getLeaf: vi.fn() });

    await repository.ensureFolder("Archive");
    await expect(repository.ensureFolder("Books/To Read")).rejects.toThrow("not a folder");
    expect(createFolder).not.toHaveBeenCalled();
  });

  it("treats a concurrent folder creator as success", async () => {
    let exists = false;
    const createFolder = vi.fn<(path: string) => Promise<object>>().mockImplementation(() => {
      exists = true;
      return Promise.reject(new Error("already exists"));
    });
    const repository = createObsidianNoteRepository({
      getFileByPath: vi.fn(() => null),
      getAbstractFileByPath: vi.fn(() => exists ? { path: "Books" } : null),
      createFolder,
      create: vi.fn(),
      process: vi.fn(),
    }, { getLeaf: vi.fn() });

    await expect(repository.ensureFolder("Books")).resolves.toBeUndefined();
  });

  it("processes the latest file content in one atomic host call", async () => {
    let current = "latest user content";
    const process = vi.fn<(target: FakeFile, update: (content: string) => string) => Promise<string>>()
      .mockImplementation((_target, update) => {
        current = update(current);
        return Promise.resolve(current);
      });
    const repository = createObsidianNoteRepository({
      getFileByPath: vi.fn().mockReturnValue(file),
      getAbstractFileByPath: vi.fn(),
      createFolder: vi.fn(),
      create: vi.fn(),
      process,
    }, { getLeaf: vi.fn() });

    await repository.process("Books/Dune.md", (content) => `${content}\nmanaged`);

    expect(current).toBe("latest user content\nmanaged");
    expect(process).toHaveBeenCalledOnce();
    expect(process.mock.calls[0]?.[0]).toBe(file);
  });

  it("fails rather than processing or opening a path that is not a file", async () => {
    const process = vi.fn();
    const getLeaf = vi.fn();
    const repository = createObsidianNoteRepository({
      getFileByPath: vi.fn().mockReturnValue(null),
      getAbstractFileByPath: vi.fn().mockReturnValue({ path: "Books" }),
      createFolder: vi.fn(),
      create: vi.fn(),
      process,
    }, { getLeaf });

    await expect(repository.process("Books", (current) => current)).rejects.toThrow("Vault file not found: Books");
    await expect(repository.open("Books")).rejects.toThrow("Vault file not found: Books");
    expect(process).not.toHaveBeenCalled();
    expect(getLeaf).not.toHaveBeenCalled();
  });

  it("opens the committed note in the current workspace leaf", async () => {
    const openFile = vi.fn<(target: FakeFile) => Promise<void>>().mockResolvedValue(undefined);
    const getLeaf = vi.fn().mockReturnValue({ openFile });
    const repository = createObsidianNoteRepository({
      getFileByPath: vi.fn().mockReturnValue(file),
      getAbstractFileByPath: vi.fn(),
      createFolder: vi.fn(),
      create: vi.fn(),
      process: vi.fn(),
    }, { getLeaf });

    await repository.open("Books/Dune.md");

    expect(getLeaf).toHaveBeenCalledWith(false);
    expect(openFile).toHaveBeenCalledWith(file);
  });

  it("propagates create, process, and note-opening host failures", async () => {
    const createFailure = new Error("create failed");
    const processFailure = new Error("process failed");
    const openFailure = new Error("open failed");
    const repository = createObsidianNoteRepository({
      getFileByPath: vi.fn().mockReturnValue(file),
      getAbstractFileByPath: vi.fn(),
      createFolder: vi.fn(),
      create: vi.fn().mockRejectedValue(createFailure),
      process: vi.fn().mockRejectedValue(processFailure),
    }, {
      getLeaf: vi.fn().mockReturnValue({
        openFile: vi.fn().mockRejectedValue(openFailure),
      }),
    });

    await expect(repository.create("Books/Dune.md", "content")).rejects.toBe(createFailure);
    await expect(repository.process("Books/Dune.md", (current) => current)).rejects.toBe(processFailure);
    await expect(repository.open("Books/Dune.md")).rejects.toBe(openFailure);
  });
});
