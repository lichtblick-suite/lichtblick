// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ILayoutStorage } from "@lichtblick/suite-base/services/ILayoutStorage";
import { NamespacedLayoutStorage } from "@lichtblick/suite-base/services/LayoutManager/NamespacedLayoutStorage";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

describe("NamespacedLayoutStorage", () => {
  let mockStorage: jest.Mocked<Required<ILayoutStorage>>;
  const testNamespace = BasicBuilder.string();

  beforeEach(() => {
    mockStorage = {
      list: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      importLayouts: jest.fn(),
      migrateUnnamespacedLayouts: jest.fn(),
    };

    mockStorage.migrateUnnamespacedLayouts.mockResolvedValue();
    mockStorage.importLayouts.mockResolvedValue();
  });

  describe("constructor", () => {
    it("should create instance without migration when both options are disabled", async () => {
      // Given
      const options = {
        migrateUnnamespacedLayouts: false,
        importFromNamespace: undefined,
      };

      // When
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, options);

      // Then
      expect(storage).toBeDefined();
      expect(mockStorage.migrateUnnamespacedLayouts).not.toHaveBeenCalled();
      expect(mockStorage.importLayouts).not.toHaveBeenCalled();
    });

    it("should create instance when migrateUnnamespacedLayouts method is undefined", async () => {
      // Given
      const options = {
        migrateUnnamespacedLayouts: true,
        importFromNamespace: undefined,
      };
      const storageWithoutMigration = {
        ...mockStorage,
        migrateUnnamespacedLayouts: undefined,
      } as ILayoutStorage;
      storageWithoutMigration.list = jest.fn().mockResolvedValue([]);

      // When
      const storage = new NamespacedLayoutStorage(storageWithoutMigration, testNamespace, options);
      const result = await storage.list(); // Should not throw

      // Then
      expect(storage).toBeDefined();
      expect(result).toEqual([]);
    });

    it("should perform migration when migrateUnnamespacedLayouts is enabled", async () => {
      // Given
      const options = {
        migrateUnnamespacedLayouts: true,
        importFromNamespace: undefined,
      };
      mockStorage.migrateUnnamespacedLayouts.mockResolvedValue();

      // When
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, options);
      await storage.list(); // Trigger migration wait

      // Then
      expect(mockStorage.migrateUnnamespacedLayouts).toHaveBeenCalledWith(testNamespace);
    });

    it("should perform import when importFromNamespace is provided", async () => {
      // Given
      const fromNamespace = BasicBuilder.string();
      const options = {
        migrateUnnamespacedLayouts: false,
        importFromNamespace: fromNamespace,
      };
      mockStorage.importLayouts.mockResolvedValue();

      // When
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, options);
      await storage.list(); // Trigger migration wait

      // Then
      expect(mockStorage.importLayouts).toHaveBeenCalledWith({
        fromNamespace,
        toNamespace: testNamespace,
      });
    });

    it("should perform both migration and import when both are enabled", async () => {
      // Given
      const fromNamespace = BasicBuilder.string();
      const options = {
        migrateUnnamespacedLayouts: true,
        importFromNamespace: fromNamespace,
      };
      mockStorage.migrateUnnamespacedLayouts.mockResolvedValue();
      mockStorage.importLayouts.mockResolvedValue();

      // When
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, options);
      await storage.list(); // Trigger migration wait

      // Then
      expect(mockStorage.migrateUnnamespacedLayouts).toHaveBeenCalledWith(testNamespace);
      expect(mockStorage.importLayouts).toHaveBeenCalledWith({
        fromNamespace,
        toNamespace: testNamespace,
      });
    });

    it("should handle migration errors gracefully", async () => {
      // Given
      const options = {
        migrateUnnamespacedLayouts: true,
        importFromNamespace: undefined,
      };
      const migrationError = new Error();
      mockStorage.migrateUnnamespacedLayouts.mockRejectedValue(migrationError);
      mockStorage.list.mockResolvedValue([]);

      // Mock console.error to avoid test framework issues
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // When
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, options);
      const result = await storage.list(); // Should not throw

      // Then
      expect(result).toEqual([]);
      expect(mockStorage.migrateUnnamespacedLayouts).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), migrationError);

      // Cleanup
      consoleSpy.mockRestore();
    });

    it("should handle import errors gracefully", async () => {
      // Given
      const fromNamespace = "source-namespace";
      const options = {
        migrateUnnamespacedLayouts: false,
        importFromNamespace: fromNamespace,
      };
      const importError = new Error();
      mockStorage.importLayouts.mockRejectedValue(importError);
      mockStorage.list.mockResolvedValue([]);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // When
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, options);
      const result = await storage.list(); // Should not throw

      // Then
      expect(result).toEqual([]);
      expect(mockStorage.importLayouts).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), importError);

      // Cleanup
      consoleSpy.mockRestore();
    });
  });

  describe("list", () => {
    it("should list layouts from the specified namespace", async () => {
      // Given
      const layouts = LayoutBuilder.layouts();
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, {
        migrateUnnamespacedLayouts: false,
        importFromNamespace: undefined,
      });
      mockStorage.list.mockResolvedValue(layouts);

      // When
      const result = await storage.list();

      // Then
      expect(result).toBe(layouts);
      expect(mockStorage.list).toHaveBeenCalledWith(testNamespace);
    });

    it("should wait for migration before listing", async () => {
      // Given
      const layouts = LayoutBuilder.layouts(1);
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, {
        migrateUnnamespacedLayouts: true,
        importFromNamespace: undefined,
      });
      mockStorage.list.mockResolvedValue(layouts);

      // When
      const result = await storage.list();

      // Then
      expect(mockStorage.migrateUnnamespacedLayouts).toHaveBeenCalled();
      expect(mockStorage.list).toHaveBeenCalledWith(testNamespace);
      expect(result).toBe(layouts);
    });
  });

  describe("get", () => {
    it("should get layout by id from the specified namespace", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const layout = LayoutBuilder.layout({ id: layoutId });
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, {
        migrateUnnamespacedLayouts: false,
        importFromNamespace: undefined,
      });
      mockStorage.get.mockResolvedValue(layout);

      // When
      const result = await storage.get(layoutId);

      // Then
      expect(result).toBe(layout);
      expect(mockStorage.get).toHaveBeenCalledWith(testNamespace, layoutId);
    });

    it("should return undefined when layout does not exist", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, {
        migrateUnnamespacedLayouts: false,
        importFromNamespace: undefined,
      });
      mockStorage.get.mockResolvedValue(undefined);

      // When
      const result = await storage.get(layoutId);

      // Then
      expect(result).toBe(undefined);
      expect(mockStorage.get).toHaveBeenCalledWith(testNamespace, layoutId);
    });
  });

  describe("put", () => {
    it("should put layout to the specified namespace", async () => {
      // Given
      const layout = LayoutBuilder.layout();
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, {
        migrateUnnamespacedLayouts: false,
        importFromNamespace: undefined,
      });
      mockStorage.put.mockResolvedValue(layout);

      // When
      const result = await storage.put(layout);

      // Then
      expect(result).toBe(layout);
      expect(mockStorage.put).toHaveBeenCalledWith(testNamespace, layout);
    });
  });

  describe("delete", () => {
    it("should delete layout from the specified namespace", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const storage = new NamespacedLayoutStorage(mockStorage, testNamespace, {
        migrateUnnamespacedLayouts: false,
        importFromNamespace: undefined,
      });
      mockStorage.delete.mockResolvedValue();

      // When
      await storage.delete(layoutId);

      // Then
      expect(mockStorage.delete).toHaveBeenCalledWith(testNamespace, layoutId);
    });
  });
});
