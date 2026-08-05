import { normalizeVaultPath } from "../core/destination";
import type { DestinationState, NoteRepositoryPort } from "../core/ports";

interface VaultHost<File> {
  readonly getAbstractFileByPath: (path: string) => object | null;
  readonly getFileByPath: (path: string) => File | null;
  readonly createFolder: (path: string) => Promise<object>;
  readonly create: (path: string, content: string) => Promise<File>;
  readonly process: (file: File, update: (current: string) => string) => Promise<string>;
}

interface WorkspaceHost<File> {
  readonly getLeaf: (newLeaf: false) => {
    readonly openFile: (file: File) => Promise<unknown>;
  };
}

const requireSafeFilePath = (path: string): string => {
  const normalized = normalizeVaultPath(path);
  if (!normalized.ok || normalized.value === "") throw new Error("Unsafe vault file path");
  return normalized.value;
};

export const createObsidianNoteRepository = <File>(
  vault: VaultHost<File>,
  workspace: WorkspaceHost<File>,
): NoteRepositoryPort => ({
  inspect: (path): Promise<DestinationState> => Promise.resolve().then(() => {
    const normalized = requireSafeFilePath(path);
    if (vault.getFileByPath(normalized) !== null) return { kind: "managed" };
      return vault.getAbstractFileByPath(normalized) === null ? { kind: "missing" } : { kind: "conflict" };
  }),
  ensureFolder: async (folder): Promise<void> => {
    const normalized = normalizeVaultPath(folder);
    if (!normalized.ok) throw new Error("Unsafe vault folder path");
    if (normalized.value === "") return;

    let current = "";
    for (const part of normalized.value.split("/")) {
      current = current === "" ? part : `${current}/${part}`;
      if (vault.getFileByPath(current) !== null) throw new Error(`Vault path is not a folder: ${current}`);
      if (vault.getAbstractFileByPath(current) !== null) continue;
      try {
        await vault.createFolder(current);
      } catch {
        if (vault.getFileByPath(current) !== null || vault.getAbstractFileByPath(current) === null) throw new Error(`Could not create vault folder: ${current}`);
      }
    }
  },
  create: async (path, content): Promise<void> => {
    await vault.create(requireSafeFilePath(path), content);
  },
  process: async (path, update): Promise<void> => {
    const normalized = requireSafeFilePath(path);
    const file = vault.getFileByPath(normalized);
    if (file === null) throw new Error(`Vault file not found: ${normalized}`);
    await vault.process(file, update);
  },
  open: async (path): Promise<void> => {
    const normalized = requireSafeFilePath(path);
    const file = vault.getFileByPath(normalized);
    if (file === null) throw new Error(`Vault file not found: ${normalized}`);
    await workspace.getLeaf(false).openFile(file);
  },
});
