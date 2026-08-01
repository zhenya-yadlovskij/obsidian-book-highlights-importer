import type { ProviderBook, ReadingStatus } from "./models";

export type LibraryGroupKey = "in-progress" | "finished" | "unread-or-unknown";

export interface LibraryGroup {
  readonly key: LibraryGroupKey;
  readonly books: readonly ProviderBook[];
}

const groupForStatus = (status: ReadingStatus): LibraryGroupKey => {
  if (status === "in-progress" || status === "finished") {
    return status;
  }
  return "unread-or-unknown";
};

const groupOrder: readonly LibraryGroupKey[] = ["in-progress", "finished", "unread-or-unknown"];

export const groupBooks = (books: readonly ProviderBook[]): readonly LibraryGroup[] => {
  const grouped = new Map<LibraryGroupKey, ProviderBook[]>();
  for (const key of groupOrder) {
    grouped.set(key, []);
  }
  for (const book of books) {
    grouped.get(groupForStatus(book.status))?.push(book);
  }
  return groupOrder
    .map((key) => ({ key, books: Object.freeze(grouped.get(key) ?? []) }))
    .filter((group) => group.books.length > 0);
};

const searchable = (book: ProviderBook): string =>
  `${book.title} ${book.authors.join(" ")}`.toLocaleLowerCase();

export const searchBooks = (groups: readonly LibraryGroup[], query: string): readonly LibraryGroup[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery === "") {
    return groups;
  }
  return groups
    .map((group) => ({
      key: group.key,
      books: Object.freeze(group.books.filter((book) => searchable(book).includes(normalizedQuery))),
    }))
    .filter((group) => group.books.length > 0);
};
