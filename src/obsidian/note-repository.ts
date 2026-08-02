import { normalizeVaultPath } from "../core/destination";
import type { DestinationState, NoteRepositoryPort } from "../core/ports";

interface VaultHost<File> {
  readonly getAbstractFileByPath: (path: string) => object | null;
  readonly getFileByPath: (path: string) => File | null;
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
