import type { BookAnnotation } from "./models";

const hasText = (value: string | undefined): boolean => value !== undefined && value.trim() !== "";

export const filterImportableAnnotations = (
  annotations: readonly BookAnnotation[],
): readonly BookAnnotation[] => annotations.filter((annotation) => hasText(annotation.text) || hasText(annotation.comment));

const numericOrInfinity = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;

const position = (annotation: BookAnnotation): number =>
  numericOrInfinity(annotation.location ?? annotation.progress);

export const orderAnnotations = (annotations: readonly BookAnnotation[]): readonly BookAnnotation[] =>
  [...annotations].sort((left, right) => {
    const sectionDifference = numericOrInfinity(left.sectionOrder) - numericOrInfinity(right.sectionOrder);
    if (sectionDifference !== 0) return sectionDifference;

    const positionDifference = position(left) - position(right);
    if (positionDifference !== 0) return positionDifference;

    const creationDifference = numericOrInfinity(left.createdAt) - numericOrInfinity(right.createdAt);
    if (creationDifference !== 0) return creationDifference;

    return left.inputIndex - right.inputIndex;
  });
