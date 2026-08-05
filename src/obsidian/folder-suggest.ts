export interface FolderSource {
  readonly getAllFolders: (includeRoot?: boolean) => readonly { readonly path: string }[];
}

export const matchingFolderPaths = (query: string, paths: readonly string[]): readonly string[] => {
  const normalizedQuery = query.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").trim().toLowerCase();
  const candidates = paths
    .map((path) => path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").trim())
    .filter((path) => path !== "");
  return [...new Set(candidates)]
    .filter((path) => normalizedQuery === "" || path.toLowerCase().startsWith(normalizedQuery))
    .sort((left, right) => left.localeCompare(right));
};
