import type { BookAnnotation } from "./models";

const hasText = (value: string | undefined): boolean => value !== undefined && value.trim() !== "";

export const filterImportableAnnotations = (
  annotations: readonly BookAnnotation[],
): readonly BookAnnotation[] => annotations.filter((annotation) => hasText(annotation.text) || hasText(annotation.comment));

const numericOrInfinity = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;

const position = (annotation: BookAnnotation): number =>
  numericOrInfinity(annotation.location ?? annotation.progress);

const compareNumbers = (left: number, right: number): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

export const orderAnnotations = (annotations: readonly BookAnnotation[]): readonly BookAnnotation[] =>
  [...annotations].sort((left, right) => {
    const sectionDifference = compareNumbers(numericOrInfinity(left.sectionOrder), numericOrInfinity(right.sectionOrder));
    if (sectionDifference !== 0) return sectionDifference;

    const positionDifference = compareNumbers(position(left), position(right));
    if (positionDifference !== 0) return positionDifference;

    const creationDifference = compareNumbers(numericOrInfinity(left.createdAt), numericOrInfinity(right.createdAt));
    if (creationDifference !== 0) return creationDifference;

    return left.inputIndex - right.inputIndex;
  });
