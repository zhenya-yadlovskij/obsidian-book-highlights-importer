import { filterImportableAnnotations } from "../core/annotations";
import { createImportSnapshot, type ImportSnapshot } from "../core/models";
import type { NoteRepositoryPort } from "../core/ports";
import { failure, ok, type Result } from "../core/results";
import { mergeFrontmatter, parseFrontmatterIdentity, serializeFrontmatter, type ManagedFrontmatter } from "./frontmatter";
import { createManagedSection, parseManagedSection, replaceManagedSection } from "./markers";
import { renderMarkdown } from "./markdown";

export type ManagedNoteError =
  | { readonly category: "invalid-snapshot" }
  | { readonly category: "empty-snapshot" }
  | { readonly category: "cancelled" }
  | { readonly category: "rendering-failed" }
  | { readonly category: "destination-conflict" }
  | { readonly category: "destination-unavailable" };

export interface ManagedNoteSuccess {
  readonly path: string;
  readonly annotationCount: number;
}

export interface ManagedNoteService {
  readonly write: (
    path: string,
    snapshot: ImportSnapshot,
    isActive?: () => boolean,
  ) => Promise<Result<ManagedNoteSuccess, ManagedNoteError>>;
}

export interface ManagedNoteDependencies {
  readonly notes: NoteRepositoryPort;
  readonly render?: (snapshot: ImportSnapshot) => string;
  readonly now?: () => number;
}

const sameIdentity = (
  left: { readonly providerId: string; readonly bookId: string },
  right: { readonly providerId: string; readonly bookId: string },
): boolean => left.providerId === right.providerId && left.bookId === right.bookId;

const hasControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
};

const folderFromPath = (path: string): string => {
  const separator = path.lastIndexOf("/");
  return separator === -1 ? "" : path.slice(0, separator);
};

export const createManagedNoteService = (dependencies: ManagedNoteDependencies): ManagedNoteService => {
  const write = async (
    path: string,
    supplied: ImportSnapshot,
    isActive?: () => boolean,
  ): Promise<Result<ManagedNoteSuccess, ManagedNoteError>> => {
    const snapshot = createImportSnapshot({
      book: supplied.book,
      annotations: filterImportableAnnotations(supplied.annotations),
      ...(supplied.fetchedAt === undefined ? {} : { fetchedAt: supplied.fetchedAt }),
    });
    if (
      snapshot.book.providerId === "" ||
      snapshot.book.bookId === "" ||
      snapshot.book.title === "" ||
      hasControlCharacter(snapshot.book.providerId) ||
      hasControlCharacter(snapshot.book.bookId)
    ) {
      return failure({ category: "invalid-snapshot" });
    }
    if (snapshot.annotations.length === 0) return failure({ category: "empty-snapshot" });

    const render = dependencies.render ?? renderMarkdown;
    let body: string;
    try {
      body = render(snapshot);
    } catch {
      return failure({ category: "rendering-failed" });
    }
    if (body.trim() === "") return failure({ category: "rendering-failed" });
    if (isActive?.() === false) return failure({ category: "cancelled" });

    const metadata: ManagedFrontmatter = {
      providerId: snapshot.book.providerId,
      bookId: snapshot.book.bookId,
      title: snapshot.book.title,
      authors: snapshot.book.authors,
      importedAt: dependencies.now?.() ?? Date.now(),
    };
    const section = createManagedSection(metadata, body);
    let destination: Awaited<ReturnType<NoteRepositoryPort["inspect"]>>;
    try {
      destination = await dependencies.notes.inspect(path);
    } catch {
      return failure({ category: "destination-conflict" });
    }
    if (isActive?.() === false) return failure({ category: "cancelled" });
    if (destination.kind === "conflict") return failure({ category: "destination-conflict" });

    if (destination.kind === "missing") {
      try {
        await dependencies.notes.ensureFolder(folderFromPath(path));
        if (isActive?.() === false) return failure({ category: "cancelled" });
        const content = `${serializeFrontmatter(metadata)}${section}\n`;
        await dependencies.notes.create(path, content);
      } catch {
        return failure({ category: "destination-unavailable" });
      }
    } else {
      try {
        await dependencies.notes.process(path, (current) => {
          const currentIdentity = parseFrontmatterIdentity(current);
          const currentSection = parseManagedSection(current);
          if (currentIdentity === undefined || !currentSection.ok || !sameIdentity(currentIdentity, metadata) || !sameIdentity(currentSection.value.identity, metadata)) {
            throw new Error("unsafe destination");
          }
          const merged = mergeFrontmatter(current, metadata);
          if (!merged.ok) throw new Error("invalid frontmatter");
          const replaced = replaceManagedSection(merged.value, metadata, body);
          if (!replaced.ok) throw new Error("unsafe marker");
          return replaced.value;
        });
      } catch {
        return failure({ category: "destination-conflict" });
      }
    }

    return ok({ path, annotationCount: snapshot.annotations.length });
  };

  return { write };
};
