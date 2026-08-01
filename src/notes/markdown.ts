import { orderAnnotations } from "../core/annotations";
import type { BookAnnotation, ImportSnapshot } from "../core/models";

const escapeInline = (value: string): string => value
  .replaceAll("\\", "\\\\")
  .replace(/[\\`*_[\]#!<>|~]/gu, "\\$&");

const withoutControls = (value: string, keepNewline: boolean): string => {
  let result = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    if ((keepNewline && character === "\n") || (code >= 32 && code !== 127)) result += character;
  }
  return result;
};

const cleanHeading = (value: string): string => escapeInline(
  withoutControls(value, false).replace(/\s+/gu, " ").trim(),
);

const escapeBlockquoteLine = (line: string): string => {
  const listMarker = /^(\d+)([.)])(?=\s|$)/u.exec(line);
  if (listMarker !== null) {
    const number = listMarker[1];
    const delimiter = listMarker[2];
    if (number !== undefined && delimiter !== undefined) {
      return `${number}\\${delimiter}${escapeInline(line.slice(listMarker[0].length))}`;
    }
  }
  const escaped = escapeInline(line);
  return /^[-+=]/u.test(line) ? `\\${escaped}` : escaped;
};

const renderBlockquote = (value: string): string => withoutControls(value, true)
  .split("\n")
  .map((line) => `> ${escapeBlockquoteLine(line)}`)
  .join("\n");

const formatPosition = (value: number): string => {
  if (!Number.isFinite(value)) return "";
  const percentage = Math.abs(value) <= 1 ? value * 100 : value;
  return `${String(Number.isInteger(percentage) ? percentage : Number(percentage.toFixed(2)))}%`;
};

const renderLocation = (annotation: BookAnnotation): string | undefined => {
  if (annotation.progress !== undefined && Number.isFinite(annotation.progress)) {
    return `_Progress: ${formatPosition(annotation.progress)}_`;
  }
  if (annotation.location !== undefined && Number.isFinite(annotation.location)) {
    return `_Location: ${formatPosition(annotation.location)}_`;
  }
  return undefined;
};

const renderAnnotation = (annotation: BookAnnotation): string => {
  const parts: string[] = [];
  if (annotation.text !== undefined && annotation.text.trim() !== "") {
    parts.push(renderBlockquote(annotation.text));
  }
  if (annotation.comment !== undefined && annotation.comment.trim() !== "") {
    parts.push(
      `> [!note] Comment\n${renderBlockquote(annotation.comment)}`,
    );
  }
  const location = renderLocation(annotation);
  if (location !== undefined) parts.push(location);
  return parts.join("\n\n");
};

const normalizedPath = (annotation: BookAnnotation): readonly string[] => (annotation.sectionPath ?? [])
  .map((segment) => cleanHeading(segment))
  .filter((segment) => segment !== "");

const cappedPath = (path: readonly string[]): readonly string[] => {
  if (path.length <= 5) return path;
  return [...path.slice(0, 4), path.slice(4).join(" / ")];
};

const pathHeadings = (path: readonly string[], previous: readonly string[]): string[] => {
  const commonLength = Math.min(path.length, previous.length);
  let common = 0;
  while (common < commonLength && path[common] === previous[common]) common += 1;

  const firstChanged = common === path.length && path.length < previous.length ? 0 : common;
  const headings: string[] = [];
  for (let index = firstChanged; index < path.length; index += 1) {
    const segment = path[index];
    if (segment !== undefined) headings.push(`${"#".repeat(index + 2)} ${segment}`);
  }
  return headings;
};

export const renderMarkdown = (snapshot: ImportSnapshot): string => {
  const sections: string[] = [`# ${cleanHeading(snapshot.book.title)}`];
  let previousPath: readonly string[] = [];
  let inFallback = false;

  for (const annotation of orderAnnotations(snapshot.annotations)) {
    const path = cappedPath(normalizedPath(annotation));
    if (path.length === 0) {
      if (!inFallback) {
        sections.push("## Highlights");
      }
      inFallback = true;
      previousPath = [];
    } else {
      inFallback = false;
      const headings = pathHeadings(path, previousPath);
      if (headings.length > 0) sections.push(headings.join("\n"));
      previousPath = path;
    }
    sections.push(renderAnnotation(annotation));
  }

  return sections.join("\n\n");
};

export const renderManagedBody = renderMarkdown;
