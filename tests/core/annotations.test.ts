import { describe, expect, it } from "vitest";
import { createBookAnnotation } from "../../src/core/models";
import { filterImportableAnnotations, orderAnnotations } from "../../src/core/annotations";

describe("annotation policy", () => {
  it("keeps highlights, comments, and paired annotations but removes empty records", () => {
    const annotations = [
      createBookAnnotation({ inputIndex: 0 }),
      createBookAnnotation({ text: "Highlight", inputIndex: 1 }),
      createBookAnnotation({ comment: "Comment", inputIndex: 2 }),
      createBookAnnotation({ text: " Highlight ", comment: " Comment ", inputIndex: 3 }),
    ];

    expect(filterImportableAnnotations(annotations).map((item) => item.inputIndex)).toEqual([1, 2, 3]);
    expect(annotations).toHaveLength(4);
  });

  it("orders by section, numeric position, creation time, and input index", () => {
    const annotations = [
      createBookAnnotation({ inputIndex: 0, sectionOrder: 2, location: 1, createdAt: 1 }),
      createBookAnnotation({ inputIndex: 1, sectionOrder: 1, location: 20, createdAt: 1 }),
      createBookAnnotation({ inputIndex: 2, sectionOrder: 1, location: 10, createdAt: 3 }),
      createBookAnnotation({ inputIndex: 3, sectionOrder: 1, location: 10, createdAt: 2 }),
      createBookAnnotation({ inputIndex: 4, sectionOrder: 1, location: 10, createdAt: 2 }),
    ];

    expect(orderAnnotations(annotations).map((item) => item.inputIndex)).toEqual([3, 4, 2, 1, 0]);
  });
});
