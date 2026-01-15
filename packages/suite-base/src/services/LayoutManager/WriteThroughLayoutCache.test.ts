// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ILayoutStorage } from "@lichtblick/suite-base/services/ILayoutStorage";
import WriteThroughLayoutCache from "@lichtblick/suite-base/services/LayoutManager/WriteThroughLayoutCache";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("WriteThroughLayoutCache", () => {
  let mockStorage: jest.Mocked<ILayoutStorage>;
  let cache: WriteThroughLayoutCache;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {
      list: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockImplementation(async (_namespace: string, layout) => layout),
      delete: jest.fn().mockResolvedValue(undefined),
      importLayouts: jest.fn().mockResolvedValue(undefined),
      migrateUnnamespacedLayouts: jest.fn().mockResolvedValue(undefined),
    };

    cache = new WriteThroughLayoutCache(mockStorage);
  });

  describe("list", () => {
    it("should initialize cache from underlying storage on first call", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layouts = LayoutBuilder.layouts(2);
      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValue(layouts);

      // When
      const result = await cache.list(namespace);

      // Then
      expect(result).toEqual(layouts);
      expect(listSpy).toHaveBeenCalledWith(namespace);
      expect(listSpy).toHaveBeenCalledTimes(1);
    });

    it("should return cached data on subsequent calls without calling underlying storage", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layouts = LayoutBuilder.layouts(1);
      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValue(layouts);

      // When
      await cache.list(namespace);
      const secondResult = await cache.list(namespace);

      // Then
      expect(secondResult).toEqual(layouts);
      expect(listSpy).toHaveBeenCalledTimes(1);
    });

    it("should maintain separate caches for different namespaces", async () => {
      // Given
      const namespace1 = BasicBuilder.string();
      const namespace2 = BasicBuilder.string();
      const layouts1 = LayoutBuilder.layouts(1);
      const layouts2 = LayoutBuilder.layouts(1);

      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValueOnce(layouts1).mockResolvedValueOnce(layouts2);

      // When
      const result1 = await cache.list(namespace1);
      const result2 = await cache.list(namespace2);

      // Then
      expect(result1).toEqual(layouts1);
      expect(result2).toEqual(layouts2);
      expect(listSpy).toHaveBeenCalledWith(namespace1);
      expect(listSpy).toHaveBeenCalledWith(namespace2);
      expect(listSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("get", () => {
    it("should return layout from cache when it exists", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layout = LayoutBuilder.layout();
      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValue([layout]);

      // When
      const result = await cache.get(namespace, layout.id);

      // Then
      expect(result).toEqual(layout);
      expect(listSpy).toHaveBeenCalledWith(namespace);
    });

    it("should return undefined when layout does not exist in cache", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layoutId = LayoutBuilder.layoutId();
      mockStorage.list.mockResolvedValue([]);

      // When
      const result = await cache.get(namespace, layoutId);

      // Then
      expect(result).toBe(undefined);
    });

    it("should use cached data and not call underlying storage list again", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layout = LayoutBuilder.layout();
      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValue([layout]);

      // When
      await cache.list(namespace); // Initialize cache
      const result = await cache.get(namespace, layout.id);

      // Then
      expect(result).toEqual(layout);
      expect(listSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("put", () => {
    it("should write through to underlying storage and update cache", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layout = LayoutBuilder.layout();
      const updatedLayout = LayoutBuilder.layout({ ...layout, name: BasicBuilder.string() });
      mockStorage.list.mockResolvedValue([]);
      const putSpy = jest.spyOn(mockStorage, "put");
      putSpy.mockResolvedValue(updatedLayout);

      // When
      const result = await cache.put(namespace, layout);

      // Then
      expect(result).toEqual(updatedLayout);
      expect(putSpy).toHaveBeenCalledWith(namespace, layout);
    });

    it("should update cache with result from underlying storage", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layout = LayoutBuilder.layout();
      const updatedLayout = LayoutBuilder.layout({ ...layout, name: BasicBuilder.string() });

      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValue([]);
      mockStorage.put.mockResolvedValue(updatedLayout);

      // When
      await cache.put(namespace, layout);
      const cachedLayout = await cache.get(namespace, layout.id);

      // Then
      expect(cachedLayout).toEqual(updatedLayout);
      expect(listSpy).toHaveBeenCalledTimes(1); // Only called to initialize cache
    });

    it("should add new layout to cache when not previously present", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const existingLayout = LayoutBuilder.layout();
      const newLayout = LayoutBuilder.layout();
      mockStorage.list.mockResolvedValue([existingLayout]);
      mockStorage.put.mockResolvedValue(newLayout);

      // When
      await cache.put(namespace, newLayout);
      const cachedLayouts = await cache.list(namespace);

      // Then
      expect(cachedLayouts).toHaveLength(2);
      expect(cachedLayouts).toContainEqual(existingLayout);
      expect(cachedLayouts).toContainEqual(newLayout);
    });
  });

  describe("delete", () => {
    it("should delete from underlying storage and remove from cache", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layout = LayoutBuilder.layout();
      mockStorage.list.mockResolvedValue([layout]);

      // When
      await cache.delete(namespace, layout.id);

      // Then
      expect(jest.spyOn(mockStorage, "delete")).toHaveBeenCalledWith(namespace, layout.id);
    });

    it("should remove layout from cache after deletion", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layout = LayoutBuilder.layout();
      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValue([layout]);

      // When
      await cache.delete(namespace, layout.id);
      const result = await cache.get(namespace, layout.id);

      // Then
      expect(result).toBe(undefined);
      expect(listSpy).toHaveBeenCalledTimes(1); // Only called to initialize cache
    });

    it("should maintain other layouts in cache after deletion", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const layoutToDelete = LayoutBuilder.layout();
      const layoutToKeep = LayoutBuilder.layout();
      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValue([layoutToDelete, layoutToKeep]);

      // When
      await cache.delete(namespace, layoutToDelete.id);
      const remainingLayouts = await cache.list(namespace);

      // Then
      expect(remainingLayouts).toHaveLength(1);
      expect(remainingLayouts[0]).toEqual(layoutToKeep);
    });
  });

  describe("importLayouts", () => {
    it("should delegate to underlying storage", async () => {
      // Given
      const fromNamespace = BasicBuilder.string();
      const toNamespace = BasicBuilder.string();
      const params = { fromNamespace, toNamespace };

      // When
      await cache.importLayouts(params);

      // Then
      expect(jest.spyOn(mockStorage, "importLayouts")).toHaveBeenCalledWith(params);
    });
  });

  describe("migrateUnnamespacedLayouts", () => {
    it("should delegate to underlying storage when method exists", async () => {
      // Given
      const namespace = BasicBuilder.string();

      // When
      await cache.migrateUnnamespacedLayouts(namespace);

      // Then
      expect(jest.spyOn(mockStorage, "migrateUnnamespacedLayouts")).toHaveBeenCalledWith(namespace);
    });

    it("should handle when underlying storage does not implement method", async () => {
      // Given
      const namespace = BasicBuilder.string();
      delete (mockStorage as any).migrateUnnamespacedLayouts;

      // When & Then
      await expect(cache.migrateUnnamespacedLayouts(namespace)).resolves.not.toThrow();
    });
  });

  describe("cache behavior", () => {
    it("should initialize cache lazily per namespace", async () => {
      // Given
      const namespace1 = BasicBuilder.string();
      const namespace2 = BasicBuilder.string();
      const layout1 = LayoutBuilder.layout();
      const layout2 = LayoutBuilder.layout();

      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValueOnce([layout1]).mockResolvedValueOnce([layout2]);

      // When
      const result1 = await cache.get(namespace1, layout1.id);
      const result2 = await cache.get(namespace2, layout2.id);

      // Then
      expect(result1).toEqual(layout1);
      expect(result2).toEqual(layout2);
      expect(listSpy).toHaveBeenCalledWith(namespace1);
      expect(listSpy).toHaveBeenCalledWith(namespace2);
      expect(listSpy).toHaveBeenCalledTimes(2);
    });

    it("should maintain cache consistency across operations", async () => {
      // Given
      const namespace = BasicBuilder.string();
      const originalLayout = LayoutBuilder.layout();
      const updatedLayout = LayoutBuilder.layout({
        ...originalLayout,
        name: BasicBuilder.string(),
      });
      const listSpy = jest.spyOn(mockStorage, "list");
      listSpy.mockResolvedValue([originalLayout]);
      mockStorage.put.mockResolvedValue(updatedLayout);

      // When
      await cache.list(namespace); // Initialize cache
      await cache.put(namespace, updatedLayout); // Update cache
      const result = await cache.get(namespace, originalLayout.id);

      // Then
      expect(result).toEqual(updatedLayout);
      expect(listSpy).toHaveBeenCalledTimes(1); // Cache prevents additional calls
    });
  });
});
