// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder } from "@lichtblick/test-builders";

import { handleReorderSeriesAction } from "./utils";

describe("handleReorderSeriesAction", () => {
  describe("successful reordering", () => {
    it("should reorder item from lower index to higher index", () => {
      // Given: A draft object with paths array and indices to reorder forward
      const paths = BasicBuilder.strings({ count: 4 }) as [string, string, string, string];
      const draft = {
        paths: [...paths],
      };
      const sourceIndex = 1;
      const targetIndex = 3;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The item at sourceIndex should be moved to targetIndex
      expect(draft.paths).toEqual([paths[0], paths[2], paths[3], paths[1]]);
    });

    it("should reorder item from higher index to lower index", () => {
      // Given: A draft object with paths array and indices to reorder backward
      const paths = BasicBuilder.strings({ count: 4 }) as [string, string, string, string];
      const draft = {
        paths: [...paths],
      };
      const sourceIndex = 3;
      const targetIndex = 1;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The item at sourceIndex should be moved to targetIndex
      expect(draft.paths).toEqual([paths[0], paths[3], paths[1], paths[2]]);
    });

    it("should reorder first item to last position", () => {
      // Given: A draft with first item to be moved to end
      const draft = {
        paths: ["first", "second", "third", "fourth"],
      };
      const sourceIndex = 0;
      const targetIndex = 3;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: First item should be at the end
      expect(draft.paths).toEqual(["second", "third", "fourth", "first"]);
    });

    it("should reorder last item to first position", () => {
      // Given: A draft with last item to be moved to beginning
      const draft = {
        paths: ["first", "second", "third", "fourth"],
      };
      const sourceIndex = 3;
      const targetIndex = 0;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Last item should be at the beginning
      expect(draft.paths).toEqual(["fourth", "first", "second", "third"]);
    });

    it("should handle reordering with adjacent indices (forward)", () => {
      // Given: A draft with adjacent source and target indices
      const paths = BasicBuilder.strings({ count: 4 }) as [string, string, string, string];
      const draft = {
        paths: [...paths],
      };
      const sourceIndex = 1;
      const targetIndex = 2;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Items should swap positions
      expect(draft.paths).toEqual([paths[0], paths[2], paths[1], paths[3]]);
    });

    it("should handle reordering with adjacent indices (backward)", () => {
      // Given: A draft with adjacent source and target indices (backward)
      const paths = BasicBuilder.strings({ count: 4 }) as [string, string, string, string];
      const draft = {
        paths: [...paths],
      };
      const sourceIndex = 2;
      const targetIndex = 1;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Items should swap positions
      expect(draft.paths).toEqual([paths[0], paths[2], paths[1], paths[3]]);
    });

    it("should work with array of objects", () => {
      // Given: A draft with paths containing objects
      const obj1 = { id: BasicBuilder.number(), name: BasicBuilder.string() };
      const obj2 = { id: BasicBuilder.number(), name: BasicBuilder.string() };
      const obj3 = { id: BasicBuilder.number(), name: BasicBuilder.string() };
      const draft = {
        paths: [obj1, obj2, obj3],
      };
      const sourceIndex = 0;
      const targetIndex = 2;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Object references should be reordered correctly
      expect(draft.paths).toEqual([obj2, obj3, obj1]);
    });

    it("should work with array containing mixed types", () => {
      // Given: A draft with paths containing various types
      const num = BasicBuilder.number();
      const str = BasicBuilder.string();
      const obj = { key: BasicBuilder.string() };
      const arr = [BasicBuilder.number(), BasicBuilder.number(), BasicBuilder.number()];
      const bool = BasicBuilder.boolean();
      const draft = {
        paths: [num, str, obj, arr, bool],
      };
      const sourceIndex = 1;
      const targetIndex = 3;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Mixed types should be reordered correctly
      expect(draft.paths).toEqual([num, obj, arr, str, bool]);
    });
  });

  describe("no-op scenarios", () => {
    it("should not modify array when sourceIndex equals targetIndex", () => {
      // Given: A draft with source and target indices being the same
      const paths = BasicBuilder.strings({ count: 3 });
      const draft = {
        paths: [...paths],
      };
      const originalPaths = [...draft.paths];
      const sourceIndex = 1;
      const targetIndex = 1;

      // When: handleReorderSeriesAction is called with equal indices
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The array should remain unchanged
      expect(draft.paths).toEqual(originalPaths);
    });

    it("should not modify array when sourceIndex is negative", () => {
      // Given: A draft with negative source index
      const paths = BasicBuilder.strings({ count: 3 });
      const draft = {
        paths: [...paths],
      };
      const originalPaths = [...draft.paths];
      const sourceIndex = -1;
      const targetIndex = 1;

      // When: handleReorderSeriesAction is called with negative sourceIndex
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The array should remain unchanged
      expect(draft.paths).toEqual(originalPaths);
    });

    it("should not modify array when targetIndex is negative", () => {
      // Given: A draft with negative target index
      const paths = BasicBuilder.strings({ count: 3 });
      const draft = {
        paths: [...paths],
      };
      const originalPaths = [...draft.paths];
      const sourceIndex = 1;
      const targetIndex = -1;

      // When: handleReorderSeriesAction is called with negative targetIndex
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The array should remain unchanged
      expect(draft.paths).toEqual(originalPaths);
    });

    it("should not modify array when both indices are negative", () => {
      // Given: A draft with both indices negative
      const paths = BasicBuilder.strings({ count: 3 });
      const draft = {
        paths: [...paths],
      };
      const originalPaths = [...draft.paths];
      const sourceIndex = -2;
      const targetIndex = -1;

      // When: handleReorderSeriesAction is called with both negative indices
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The array should remain unchanged
      expect(draft.paths).toEqual(originalPaths);
    });

    it("should not modify array when sourceIndex is out of bounds (too large)", () => {
      // Given: A draft with sourceIndex beyond array length
      const paths = BasicBuilder.strings({ count: 3 });
      const draft = {
        paths: [...paths],
      };
      const originalPaths = [...draft.paths];
      const sourceIndex = 5;
      const targetIndex = 1;

      // When: handleReorderSeriesAction is called with out-of-bounds sourceIndex
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The array should remain unchanged
      expect(draft.paths).toEqual(originalPaths);
    });

    it("should not modify array when targetIndex is out of bounds (too large)", () => {
      // Given: A draft with targetIndex beyond array length
      const paths = BasicBuilder.strings({ count: 3 });
      const draft = {
        paths: [...paths],
      };
      const originalPaths = [...draft.paths];
      const sourceIndex = 1;
      const targetIndex = 5;

      // When: handleReorderSeriesAction is called with out-of-bounds targetIndex
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The array should remain unchanged
      expect(draft.paths).toEqual(originalPaths);
    });

    it("should not modify array when both indices are out of bounds", () => {
      // Given: A draft with both indices out of bounds
      const paths = BasicBuilder.strings({ count: 3 });
      const draft = {
        paths: [...paths],
      };
      const originalPaths = [...draft.paths];
      const sourceIndex = 10;
      const targetIndex = 20;

      // When: handleReorderSeriesAction is called with both out-of-bounds indices
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The array should remain unchanged
      expect(draft.paths).toEqual(originalPaths);
    });

    it("should not modify empty array", () => {
      // Given: A draft with empty paths array
      const draft = {
        paths: [],
      };
      const sourceIndex = 0;
      const targetIndex = 0;

      // When: handleReorderSeriesAction is called on empty array
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The array should remain empty
      expect(draft.paths).toEqual([]);
    });

    it("should not modify single-item array", () => {
      // Given: A draft with single item in paths array
      const singleItem = BasicBuilder.string();
      const draft = {
        paths: [singleItem],
      };
      const sourceIndex = 0;
      const targetIndex = 0;

      // When: handleReorderSeriesAction is called on single-item array
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: The array should remain unchanged
      expect(draft.paths).toEqual([singleItem]);
    });
  });

  describe("edge cases", () => {
    it("should handle reordering at boundary indices (0 and length-1)", () => {
      // Given: A draft with reordering at array boundaries
      const draft = {
        paths: ["start", "middle", "end"],
      };
      const sourceIndex = 0;
      const targetIndex = 2;

      // When: handleReorderSeriesAction is called with boundary indices
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Reordering should work correctly at boundaries
      expect(draft.paths).toEqual(["middle", "end", "start"]);
    });

    it("should maintain array length after reordering", () => {
      // Given: A draft with specific array length
      const draft = {
        paths: ["a", "b", "c", "d", "e"],
      };
      const originalLength = draft.paths.length;
      const sourceIndex = 1;
      const targetIndex = 3;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Array length should remain the same
      expect(draft.paths.length).toBe(originalLength);
    });

    it("should preserve object references after reordering", () => {
      // Given: A draft with object references in paths
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const obj3 = { id: 3 };
      const draft = {
        paths: [obj1, obj2, obj3],
      };
      const sourceIndex = 0;
      const targetIndex = 2;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Object references should be preserved (same instances)
      expect(draft.paths[2]).toBe(obj1);
      expect(draft.paths[0]).toBe(obj2);
      expect(draft.paths[1]).toBe(obj3);
    });

    it("should work with draft object containing additional properties", () => {
      // Given: A draft with paths and other properties
      const paths = BasicBuilder.strings({ count: 3 }) as [string, string, string];
      const otherProperty = BasicBuilder.string();
      const anotherProp = BasicBuilder.number();
      const draft = {
        paths: [...paths],
        otherProperty,
        anotherProp,
      };
      const sourceIndex = 0;
      const targetIndex = 2;

      // When: handleReorderSeriesAction is called
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Only paths should be modified, other properties unchanged
      expect(draft.paths).toEqual([paths[1], paths[2], paths[0]]);
      expect(draft.otherProperty).toBe(otherProperty);
      expect(draft.anotherProp).toBe(anotherProp);
    });

    it("should handle large arrays efficiently", () => {
      // Given: A draft with large paths array
      const largePaths = Array.from({ length: 1000 }, () => BasicBuilder.string());
      const draft = {
        paths: [...largePaths],
      };
      const firstItem = draft.paths[0];
      const secondItem = draft.paths[1];
      const sourceIndex = 0;
      const targetIndex = 999;

      // When: handleReorderSeriesAction is called on large array
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Reordering should work correctly
      expect(draft.paths[999]).toBe(firstItem);
      expect(draft.paths[0]).toBe(secondItem);
      expect(draft.paths.length).toBe(1000);
    });
  });

  describe("type compatibility", () => {
    it("should work with draft type containing paths of strings", () => {
      // Given: A strongly-typed draft with string paths
      type StringPathDraft = { paths: string[] };
      const paths = BasicBuilder.strings({ count: 3 }) as [string, string, string];
      const draft: StringPathDraft = {
        paths: [...paths],
      };
      const sourceIndex = 0;
      const targetIndex = 2;

      // When: handleReorderSeriesAction is called with typed draft
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Type system should work correctly
      expect(draft.paths).toEqual([paths[1], paths[2], paths[0]]);
    });

    it("should work with draft type containing paths of numbers", () => {
      // Given: A strongly-typed draft with number paths
      type NumberPathDraft = { paths: number[] };
      const num1 = BasicBuilder.number();
      const num2 = BasicBuilder.number();
      const num3 = BasicBuilder.number();
      const num4 = BasicBuilder.number();
      const draft: NumberPathDraft = {
        paths: [num1, num2, num3, num4],
      };
      const sourceIndex = 1;
      const targetIndex = 3;

      // When: handleReorderSeriesAction is called with typed draft
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Type system should work correctly with numbers
      expect(draft.paths).toEqual([num1, num3, num4, num2]);
    });

    it("should work with complex nested object types", () => {
      // Given: A draft with complex nested objects in paths
      type ComplexPath = {
        id: string;
        config: { enabled: boolean; value: number };
        metadata: { tags: string[] };
      };
      type ComplexDraft = { paths: ComplexPath[] };
      const obj1: ComplexPath = {
        id: BasicBuilder.string(),
        config: { enabled: BasicBuilder.boolean(), value: BasicBuilder.number() },
        metadata: { tags: BasicBuilder.strings({ count: 2 }) },
      };
      const obj2: ComplexPath = {
        id: BasicBuilder.string(),
        config: { enabled: BasicBuilder.boolean(), value: BasicBuilder.number() },
        metadata: { tags: BasicBuilder.strings({ count: 2 }) },
      };
      const obj3: ComplexPath = {
        id: BasicBuilder.string(),
        config: { enabled: BasicBuilder.boolean(), value: BasicBuilder.number() },
        metadata: { tags: BasicBuilder.strings({ count: 2 }) },
      };
      const draft: ComplexDraft = {
        paths: [obj1, obj2, obj3],
      };
      const sourceIndex = 0;
      const targetIndex = 2;

      // When: handleReorderSeriesAction is called with complex types
      handleReorderSeriesAction(draft, sourceIndex, targetIndex);

      // Then: Complex objects should be reordered correctly
      expect(draft.paths[0]?.id).toBe(obj2.id);
      expect(draft.paths[1]?.id).toBe(obj3.id);
      expect(draft.paths[2]?.id).toBe(obj1.id);
    });
  });
});
