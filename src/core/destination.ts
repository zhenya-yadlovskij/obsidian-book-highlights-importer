import type { ImportSettings, Result } from "./ports";
import { failure, ok } from "./ports";

export interface DestinationError {
  readonly category: "unsafe-path";
}

const hasControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
};

export const chooseDestinationFolder = (settings: ImportSettings): string => {
  const lastFolder = settings.lastFolder?.trim();
  return lastFolder === undefined || lastFolder === "" ? settings.defaultFolder.trim() : lastFolder;
};

export const normalizeVaultPath = (path: string): Result<string, DestinationError> => {
  if (hasControlCharacter(path)) {
    return failure({ category: "unsafe-path" });
  }

  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") return failure({ category: "unsafe-path" });
    parts.push(part);
  }
  return ok(parts.join("/"));
};

const cleanFilenamePart = (value: string, fallback: string): string => {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, " - ")
    .replace(/./gs, (character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127 ? character : "";
    })
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned === "" ? fallback : cleaned;
};

export const sanitizeFilename = (author: string, title: string): string =>
  `${cleanFilenamePart(author, "Unknown Author")} - ${cleanFilenamePart(title, "Untitled")}.md`;

export const createDestination = (folder: string, filename: string): Result<string, DestinationError> => {
  if (hasControlCharacter(filename) || filename.includes("/") || filename.includes("\\") || filename.trim() === "") {
    return failure({ category: "unsafe-path" });
  }
  const normalizedFolder = normalizeVaultPath(folder);
  if (!normalizedFolder.ok) return normalizedFolder;
  const normalizedFilename = filename.replaceAll("/", "").replaceAll("\\", "").trim();
  if (normalizedFilename === "" || normalizedFilename === "." || normalizedFilename === "..") {
    return failure({ category: "unsafe-path" });
  }
  return ok(normalizedFolder.value === "" ? normalizedFilename : `${normalizedFolder.value}/${normalizedFilename}`);
};
