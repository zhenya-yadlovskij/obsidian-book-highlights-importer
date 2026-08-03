const REQUIRED_HEADERS = [
  "book_title",
  "book_authors",
  "content",
  "comment",
  "color",
  "created_at",
] as const;

export interface YandexQuoteCsvRow {
  readonly book_title: string;
  readonly book_authors: string;
  readonly content: string;
  readonly comment: string;
  readonly color: string;
  readonly created_at: string;
}

const parseRecords = (value: string): readonly string[][] => {
  if (value === "") throw new Error("Empty CSV export");

  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let state: "start" | "unquoted" | "quoted" | "after-quote" = "start";

  const finishRecord = (): void => {
    fields.push(field);
    records.push(fields);
    fields = [];
    field = "";
    state = "start";
  };

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === undefined) continue;

    if (state === "quoted") {
      if (character === '"') {
        if (value[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          state = "after-quote";
        }
      } else {
        field += character;
      }
      continue;
    }

    if (state === "after-quote") {
      if (character === '"') throw new Error("Invalid escaped quote");
      if (character === ",") {
        fields.push(field);
        field = "";
        state = "start";
        continue;
      }
      if (character === "\n") {
        finishRecord();
        continue;
      }
      if (character === "\r" && value[index + 1] === "\n") {
        index += 1;
        finishRecord();
        continue;
      }
      throw new Error("Invalid characters after quoted field");
    }

    if (character === '"') {
      if (state !== "start") throw new Error("Invalid quote transition");
      state = "quoted";
      continue;
    }
    if (character === ",") {
      fields.push(field);
      field = "";
      state = "start";
      continue;
    }
    if (character === "\n") {
      finishRecord();
      continue;
    }
    if (character === "\r") {
      if (value[index + 1] !== "\n") throw new Error("Invalid record terminator");
      index += 1;
      finishRecord();
      continue;
    }

    field += character;
    state = "unquoted";
  }

  if (state === "quoted") throw new Error("Unterminated quoted field");
  if (!value.endsWith("\n")) {
    fields.push(field);
    records.push(fields);
  }
  return records;
};

export const parseYandexQuoteCsv = (value: string): readonly YandexQuoteCsvRow[] => {
  const records = parseRecords(value.startsWith("\uFEFF") ? value.slice(1) : value);
  const header = records[0];
  if (header === undefined || header.length === 0 || header.some((name) => name === "")) {
    throw new Error("Invalid CSV header");
  }

  const headerIndexes = new Map<string, number>();
  for (const [index, name] of header.entries()) {
    if (headerIndexes.has(name)) throw new Error("Duplicate CSV header");
    headerIndexes.set(name, index);
  }
  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headerIndexes.has(requiredHeader)) throw new Error("Missing required CSV header");
  }

  const rows = records.slice(1).map((record) => {
    if (record.length !== header.length) throw new Error("CSV field count mismatch");
    const valueAt = (name: typeof REQUIRED_HEADERS[number]): string => {
      const index = headerIndexes.get(name);
      if (index === undefined) throw new Error("Missing required CSV header");
      return record[index] ?? "";
    };
    return Object.freeze({
      book_title: valueAt("book_title"),
      book_authors: valueAt("book_authors"),
      content: valueAt("content"),
      comment: valueAt("comment"),
      color: valueAt("color"),
      created_at: valueAt("created_at"),
    });
  });
  return Object.freeze(rows);
};

const isLeapYear = (year: number): boolean => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export const parseYandexQuoteCreatedAt = (value: string): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(value);
  if (match === null) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[8]);
  const offsetMinute = Number(match[9]);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 || month > 12 || day < 1 || day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59
  ) return undefined;

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  const offsetSeconds = (offsetHour * 60 + offsetMinute) * 60;
  const sign = match[7] === "+" ? 1 : -1;
  return date.getTime() / 1000 - sign * offsetSeconds;
};
