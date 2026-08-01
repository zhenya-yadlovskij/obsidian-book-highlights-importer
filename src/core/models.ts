export type ReadingStatus = "in-progress" | "finished" | "unread" | "unknown";

export interface ProviderBookInput {
  readonly providerId: string;
  readonly bookId: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly status?: unknown;
  readonly progress?: number;
  readonly sourceUrl?: string;
}

export interface ProviderBook {
  readonly providerId: string;
  readonly bookId: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly status: ReadingStatus;
  readonly progress?: number;
  readonly sourceUrl?: string;
}

export interface BookAnnotationInput {
  readonly text?: string;
  readonly comment?: string;
  readonly sourceKey?: string;
  readonly sectionPath?: readonly string[];
  readonly sectionOrder?: number;
  readonly location?: number;
  readonly progress?: number;
  readonly createdAt?: number;
  readonly inputIndex: number;
}

export interface BookAnnotation {
  readonly text?: string;
  readonly comment?: string;
  readonly sourceKey?: string;
  readonly sectionPath?: readonly string[];
  readonly sectionOrder?: number;
  readonly location?: number;
  readonly progress?: number;
  readonly createdAt?: number;
  readonly inputIndex: number;
}

export interface ImportSnapshotInput {
  readonly book: ProviderBook;
  readonly annotations: readonly BookAnnotation[];
  readonly fetchedAt?: number;
}

export interface ImportSnapshot {
  readonly book: ProviderBook;
  readonly annotations: readonly BookAnnotation[];
  readonly fetchedAt?: number;
}

const normalizedText = (value: string): string => value.trim();

export const normalizeReadingStatus = (value: unknown): ReadingStatus => {
  if (typeof value !== "string") {
    return "unknown";
  }

  switch (value.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-")) {
    case "in-progress":
    case "reading":
    case "started":
      return "in-progress";
    case "finished":
    case "complete":
    case "completed":
    case "read":
      return "finished";
    case "unread":
    case "not-started":
    case "new":
      return "unread";
    default:
      return "unknown";
  }
};

export const createProviderBook = (input: ProviderBookInput): ProviderBook => {
  const authors = Object.freeze(input.authors.map(normalizedText));
  const result: ProviderBook = {
    providerId: normalizedText(input.providerId),
    bookId: normalizedText(input.bookId),
    title: normalizedText(input.title),
    authors,
    status: normalizeReadingStatus(input.status),
    ...(input.progress === undefined ? {} : { progress: input.progress }),
    ...(input.sourceUrl === undefined ? {} : { sourceUrl: normalizedText(input.sourceUrl) }),
  };
  return Object.freeze(result);
};

export const createBookAnnotation = (input: BookAnnotationInput): BookAnnotation => {
  const sectionPath = input.sectionPath === undefined
    ? undefined
    : Object.freeze(input.sectionPath.map(normalizedText));
  const result: BookAnnotation = {
    ...(input.text === undefined ? {} : { text: normalizedText(input.text) }),
    ...(input.comment === undefined ? {} : { comment: normalizedText(input.comment) }),
    ...(input.sourceKey === undefined ? {} : { sourceKey: normalizedText(input.sourceKey) }),
    ...(sectionPath === undefined ? {} : { sectionPath }),
    ...(input.sectionOrder === undefined ? {} : { sectionOrder: input.sectionOrder }),
    ...(input.location === undefined ? {} : { location: input.location }),
    ...(input.progress === undefined ? {} : { progress: input.progress }),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    inputIndex: input.inputIndex,
  };
  return Object.freeze(result);
};

export const createImportSnapshot = (input: ImportSnapshotInput): ImportSnapshot => {
  const book = createProviderBook(input.book);
  const annotations = Object.freeze(input.annotations.map((annotation) => createBookAnnotation(annotation)));
  const result: ImportSnapshot = {
    book,
    annotations,
    ...(input.fetchedAt === undefined ? {} : { fetchedAt: input.fetchedAt }),
  };
  return Object.freeze(result);
};
