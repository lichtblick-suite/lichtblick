// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  ILayoutStorage,
  ISO8601Timestamp,
  LayoutPermission,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import { IRemoteLayoutStorage } from "@lichtblick/suite-base/services/IRemoteLayoutStorage";
import LayoutManager from "@lichtblick/suite-base/services/LayoutManager/LayoutManager";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

describe("LayoutManager", () => {
  let mockLocalStorage: jest.Mocked<ILayoutStorage>;
  let mockRemoteStorage: jest.Mocked<IRemoteLayoutStorage>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLocalStorage = {
      list: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockImplementation(async (_namespace: string, layout) => layout),
      delete: jest.fn().mockResolvedValue(undefined),
      importLayouts: jest.fn().mockResolvedValue(undefined),
      migrateUnnamespacedLayouts: jest.fn().mockResolvedValue(undefined),
    };

    mockRemoteStorage = {
      workspace: BasicBuilder.string(),
      getLayouts: jest.fn().mockResolvedValue([]),
      getLayout: jest.fn().mockResolvedValue(undefined),
      saveNewLayout: jest.fn(),
      updateLayout: jest.fn(),
      deleteLayout: jest.fn().mockResolvedValue(true),
    };
  });

  describe("constructor", () => {
    it("should initialize with supportsSharing=true when remote storage is provided", () => {
      // Given, When
      const manager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });

      // Then
      expect(manager.supportsSharing).toBe(true);
    });

    it("should initialize with supportsSharing=false when remote storage is not provided", () => {
      // Given, When
      const manager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });

      // Then
      expect(manager.supportsSharing).toBe(false);
    });
  });

  describe("setOnline", () => {
    it("should set isOnline=true and emit onlinechange event", () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const mockOnlineChangeListener = jest.fn();
      layoutManager.on("onlinechange", mockOnlineChangeListener);

      // When
      layoutManager.setOnline({ online: true });

      // Then
      expect(layoutManager.isOnline).toBe(true);
      expect(mockOnlineChangeListener).toHaveBeenCalledTimes(1);
    });

    it("should set isOnline=false and emit onlinechange event", () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const mockOnlineChangeListener = jest.fn();
      layoutManager.on("onlinechange", mockOnlineChangeListener);

      // When
      layoutManager.setOnline({ online: false });

      // Then
      expect(layoutManager.isOnline).toBe(false);
      expect(mockOnlineChangeListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("setError", () => {
    it("should set error and emit errorchange event", () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const mockErrorChangeListener = jest.fn();
      const testError = new Error("Test error");
      layoutManager.on("errorchange", mockErrorChangeListener);

      // When
      layoutManager.setError(testError);

      // Then
      expect(layoutManager.error).toBe(testError);
      expect(mockErrorChangeListener).toHaveBeenCalledTimes(1);
    });

    it("should clear error and emit errorchange event", () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const mockErrorChangeListener = jest.fn();
      layoutManager.on("errorchange", mockErrorChangeListener);

      // When
      layoutManager.setError(undefined);

      // Then
      expect(layoutManager.error).toBe(undefined);
      expect(mockErrorChangeListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("getLayouts", () => {
    it("should return layouts that are not deleted", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const activeLayout = LayoutBuilder.layout({
        syncInfo: { status: "tracked", lastRemoteSavedAt: undefined },
      });
      const deletedLayout = LayoutBuilder.layout({
        syncInfo: { status: "locally-deleted", lastRemoteSavedAt: undefined },
      });
      const listSpy = jest.spyOn(mockLocalStorage, "list");
      listSpy.mockResolvedValue([activeLayout, deletedLayout]);

      // When
      const result = await layoutManager.getLayouts();

      // Then
      expect(result).toEqual([activeLayout]);
      expect(listSpy).toHaveBeenCalledWith(expect.any(String));
    });

    it("should return empty array when no layouts exist", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      mockLocalStorage.list.mockResolvedValue([]);

      // When
      const result = await layoutManager.getLayouts();

      // Then
      expect(result).toEqual([]);
    });
  });

  describe("getLayout", () => {
    it("should return layout when it exists locally and is not deleted", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const existingLayout = LayoutBuilder.layout({
        id: layoutId,
        syncInfo: { status: "tracked", lastRemoteSavedAt: undefined },
      });

      // Include the layout in list results so it gets cached
      mockLocalStorage.list.mockResolvedValue([existingLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });

      // When
      const result = await layoutManager.getLayout(layoutId);

      // Then
      expect(result).toEqual(existingLayout);
    });

    it("should return undefined when layout exists locally but is deleted", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const deletedLayout = LayoutBuilder.layout({
        id: layoutId,
        syncInfo: { status: "locally-deleted", lastRemoteSavedAt: undefined },
      });

      // Include the deleted layout in list results
      mockLocalStorage.list.mockResolvedValue([deletedLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });

      // When
      const result = await layoutManager.getLayout(layoutId);

      // Then
      expect(result).toBe(undefined);
    });

    it("should return undefined when layout does not exist locally and no remote storage", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      mockLocalStorage.list.mockResolvedValue([]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });

      // When
      const result = await layoutManager.getLayout(layoutId);

      // Then
      expect(result).toBe(undefined);
    });

    it("should return undefined when layout does not exist locally and offline", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      mockLocalStorage.list.mockResolvedValue([]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: false });

      // When
      const result = await layoutManager.getLayout(layoutId);

      // Then
      expect(result).toBe(undefined);
      expect(mockRemoteStorage.getLayout).not.toHaveBeenCalled();
    });

    it("should fetch from remote and cache when layout does not exist locally but exists remotely", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const remoteLayoutData = LayoutBuilder.remoteLayout({
        id: layoutId,
        name: "Remote Layout",
      });

      mockLocalStorage.list.mockResolvedValue([]);
      mockRemoteStorage.getLayout.mockResolvedValue(remoteLayoutData);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: true });

      // When
      const result = await layoutManager.getLayout(layoutId);

      // Then
      expect(result).toBeDefined();
      expect(result?.id).toBe(layoutId);
      expect(result?.name).toBe("Remote Layout");
      expect(mockRemoteStorage.getLayout).toHaveBeenCalledWith(layoutId);
      expect(jest.spyOn(mockLocalStorage, "put")).toHaveBeenCalled();
    });

    it("should return undefined when layout does not exist locally or remotely", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      mockLocalStorage.list.mockResolvedValue([]);
      mockRemoteStorage.getLayout.mockResolvedValue(undefined);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: true });

      // When
      const result = await layoutManager.getLayout(layoutId);

      // Then
      expect(result).toBe(undefined);
      expect(mockRemoteStorage.getLayout).toHaveBeenCalledWith(layoutId);
      expect(jest.spyOn(mockLocalStorage, "put")).not.toHaveBeenCalled();
    });
  });

  describe("saveNewLayout", () => {
    it("should throw error when trying to save shared layout without remote storage", async () => {
      // Given
      const manager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const layoutName = BasicBuilder.string();
      const layoutData = LayoutBuilder.data();
      const permission: LayoutPermission = "ORG_WRITE";

      // When & Then
      await expect(
        manager.saveNewLayout({
          name: layoutName,
          data: layoutData,
          permission,
        }),
      ).rejects.toThrow("Shared layouts are not supported without remote layout storage");
    });

    it("should save new personal layout locally", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const layoutName = BasicBuilder.string();
      const layoutData = LayoutBuilder.data();
      const permission: LayoutPermission = "CREATOR_WRITE";
      const savedLayout = LayoutBuilder.layout({
        name: layoutName,
        permission,
      });

      const putSpy = jest.spyOn(mockLocalStorage, "put");
      putSpy.mockResolvedValue(savedLayout);
      putSpy.mockResolvedValue(savedLayout);

      // When
      const result = await layoutManager.saveNewLayout({
        name: layoutName,
        data: layoutData,
        permission,
      });

      // Then
      expect(result).toBe(savedLayout);
      expect(putSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: layoutName,
          permission,
          baseline: expect.objectContaining({ data: layoutData }),
          working: undefined,
        }),
      );
      expect(mockRemoteStorage.saveNewLayout).not.toHaveBeenCalled();
    });

    it("should save new personal layout locally and remotelly", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      const layoutName = BasicBuilder.string();
      const layoutData = LayoutBuilder.data();
      const permission: LayoutPermission = "ORG_WRITE";
      const savedRemoteLayout = LayoutBuilder.remoteLayout({
        name: layoutName,
        permission,
      });
      const savedLocalLayout = LayoutBuilder.layout({
        id: savedRemoteLayout.id,
        name: layoutName,
        permission,
      });

      mockRemoteStorage.saveNewLayout.mockResolvedValue(savedRemoteLayout);
      const putSpy = jest.spyOn(mockLocalStorage, "put");
      putSpy.mockResolvedValue(savedLocalLayout);
      layoutManager.setOnline({ online: true });

      // When
      const result = await layoutManager.saveNewLayout({
        name: layoutName,
        data: layoutData,
        permission,
      });

      // Then
      expect(result).toBe(savedLocalLayout);
      expect(mockRemoteStorage.saveNewLayout).toHaveBeenCalled();
      expect(mockRemoteStorage.saveNewLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          name: layoutName,
          data: expect.any(Object),
          permission,
        }),
      );
      expect(putSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          id: savedRemoteLayout.id,
          name: savedRemoteLayout.name,
          permission: savedRemoteLayout.permission,
          baseline: expect.objectContaining({
            data: savedRemoteLayout.data,
            savedAt: savedRemoteLayout.savedAt,
          }),
          working: undefined,
          syncInfo: { status: "tracked", lastRemoteSavedAt: savedRemoteLayout.savedAt },
        }),
      );
    });

    it("should throw error when trying to share layout while offline", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      const layoutName = BasicBuilder.string();
      const layoutData = LayoutBuilder.data();
      const permission: LayoutPermission = "ORG_WRITE";
      layoutManager.setOnline({ online: false });

      // When & Then
      await expect(
        layoutManager.saveNewLayout({
          name: layoutName,
          data: layoutData,
          permission,
        }),
      ).rejects.toThrow("Cannot share a layout while offline");
    });
  });

  describe("updateLayout", () => {
    it("should throw error when layout does not exist", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const layoutId = LayoutBuilder.layoutId();
      mockLocalStorage.get.mockResolvedValue(undefined);

      const randomLayoutName = BasicBuilder.string();

      // When & Then
      await expect(
        layoutManager.updateLayout({
          id: layoutId,
          name: randomLayoutName,
          data: undefined,
        }),
      ).rejects.toThrow(
        `Cannot update layout ${layoutId} (${randomLayoutName}) because it does not exist`,
      );
    });

    it("should throw error when trying to update shared layout while offline", async () => {
      // Given
      const newName = BasicBuilder.string();
      const sharedLayout = LayoutBuilder.layout({
        permission: "ORG_WRITE",
      });

      // Need to include the shared layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([sharedLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: false });

      // When & Then
      await expect(
        layoutManager.updateLayout({
          id: sharedLayout.id,
          name: newName,
          data: undefined,
        }),
      ).rejects.toThrow("Cannot update a shared layout while offline");
    });

    it("should update shared layout while online", async () => {
      // Given
      const newName = BasicBuilder.string();
      const sharedLayout = LayoutBuilder.layout({
        permission: "ORG_WRITE",
      });
      const remoteLayout = LayoutBuilder.remoteLayout({
        id: sharedLayout.id,
        name: newName,
        permission: sharedLayout.permission,
      });

      mockLocalStorage.list.mockResolvedValue([sharedLayout]);
      mockRemoteStorage.updateLayout.mockResolvedValue({
        status: "success",
        newLayout: remoteLayout,
      });

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: true });

      // When
      await layoutManager.updateLayout({
        id: sharedLayout.id,
        name: newName,
        data: undefined,
      });

      // Then
      expect(mockRemoteStorage.updateLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sharedLayout.id,
          name: newName,
        }),
      );
    });

    it("should update when is only local layout", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const newName = BasicBuilder.string();
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE",
      });

      mockLocalStorage.list.mockResolvedValue([localLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      layoutManager.setOnline({ online: true });

      // When
      await layoutManager.updateLayout({
        id: layoutId,
        name: newName,
        data: undefined,
      });

      // Then
      expect(jest.spyOn(mockLocalStorage, "put")).toHaveBeenCalledWith(
        "local",
        expect.objectContaining({
          id: layoutId,
          name: newName,
        }),
      );
    });

    it("should throw if layout does not contain externalId", async () => {
      // Given
      const newName = BasicBuilder.string();
      const sharedLayout = LayoutBuilder.layout({
        permission: "ORG_WRITE",
      });

      sharedLayout.externalId = undefined;

      // Need to include the shared layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([sharedLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: true });

      // When & Then
      await expect(
        layoutManager.updateLayout({
          id: sharedLayout.id,
          name: newName,
          data: undefined,
        }),
      ).rejects.toThrow("Local layout does not have externalId");
    });
  });

  describe("deleteLayout", () => {
    it("should throw error when layout does not exist", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const layoutId = LayoutBuilder.layoutId();
      mockLocalStorage.get.mockResolvedValue(undefined);

      // When & Then
      await expect(layoutManager.deleteLayout({ id: layoutId })).rejects.toThrow(
        `Cannot delete layout ${layoutId} because it does not exist`,
      );
    });

    it("should throw error when trying to delete and is not remote", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const sharedLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "ORG_WRITE",
        syncInfo: {
          status: "tracked",
          lastRemoteSavedAt: "2023-01-01T00:00:00Z" as ISO8601Timestamp,
        },
      });

      // Need to include the shared layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([sharedLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      layoutManager.setOnline({ online: false });

      // When & Then
      await expect(layoutManager.deleteLayout({ id: layoutId })).rejects.toThrow(
        "Shared layouts are not supported without remote layout storage",
      );
    });

    it("should throw error when trying to delete shared layout while offline", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const sharedLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "ORG_WRITE",
        syncInfo: {
          status: "tracked",
          lastRemoteSavedAt: "2023-01-01T00:00:00Z" as ISO8601Timestamp,
        },
      });

      // Need to include the shared layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([sharedLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: false });

      // When & Then
      await expect(layoutManager.deleteLayout({ id: layoutId })).rejects.toThrow(
        "Cannot delete a shared layout while offline",
      );
    });

    it("should throw if layout does not contain externalId", async () => {
      // Given
      const sharedLayout = LayoutBuilder.layout({
        permission: "ORG_WRITE",
      });

      sharedLayout.externalId = undefined;

      // Need to include the shared layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([sharedLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: true });

      // When & Then
      await expect(layoutManager.deleteLayout({ id: sharedLayout.id })).rejects.toThrow(
        "Local layout does not have externalId",
      );
    });

    it("should delete layout when online", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const sharedLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE",
        syncInfo: {
          status: "tracked",
          lastRemoteSavedAt: "2023-01-01T00:00:00Z" as ISO8601Timestamp,
        },
      });

      // Need to include the shared layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([sharedLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: true });

      // When
      await layoutManager.deleteLayout({ id: layoutId });

      // Then
      expect(jest.spyOn(mockLocalStorage, "put")).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          id: layoutId,
        }),
      );
    });
  });

  describe("overwriteLayout", () => {
    it("should throw error when layout does not exist", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const layoutId = LayoutBuilder.layoutId();
      mockLocalStorage.get.mockResolvedValue(undefined);

      // When & Then
      await expect(layoutManager.overwriteLayout({ id: layoutId })).rejects.toThrow(
        `Cannot overwrite layout ${layoutId} because it does not exist`,
      );
    });

    it("should throw error when trying to overwrite shared layout while offline", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const sharedLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "ORG_WRITE",
      });

      // Need to include the shared layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([sharedLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: false });

      // When & Then
      await expect(layoutManager.overwriteLayout({ id: layoutId })).rejects.toThrow(
        "Cannot save a shared layout while offline",
      );
    });

    it("should overwrite shared layout when online", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const sharedLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "ORG_WRITE",
        working: {
          data: LayoutBuilder.data(),
          savedAt: "2023-01-01T00:00:00Z" as ISO8601Timestamp,
        },
      });
      const remoteLayout = LayoutBuilder.remoteLayout({
        id: layoutId,
        permission: "ORG_WRITE",
        data: sharedLayout.working!.data,
      });

      // Include the shared layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([sharedLayout]);
      mockRemoteStorage.updateLayout.mockResolvedValue({
        status: "success",
        newLayout: remoteLayout,
      });

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      layoutManager.setOnline({ online: true });

      // When
      const result = await layoutManager.overwriteLayout({ id: layoutId });

      // Then
      expect(mockRemoteStorage.updateLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          id: layoutId,
          data: sharedLayout.working!.data,
        }),
      );
      expect(result.working).toBe(undefined);
      expect(result.baseline.data).toEqual(remoteLayout.data);
      expect(result.syncInfo?.status).toBe("tracked");
    });

    it("should overwrite non-shared layout locally", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE",
        working: {
          data: LayoutBuilder.data(),
          savedAt: "2023-01-01T00:00:00Z" as ISO8601Timestamp,
        },
      });

      // Include the layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([localLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });

      // When
      const result = await layoutManager.overwriteLayout({ id: layoutId });

      // Then
      expect(jest.spyOn(mockLocalStorage, "put")).toHaveBeenCalledWith(
        "local",
        expect.objectContaining({
          id: layoutId,
          baseline: expect.objectContaining({
            data: localLayout.working!.data,
          }),
          working: undefined,
        }),
      );
      expect(result.working).toBe(undefined);
      expect(result.baseline.data).toEqual(localLayout.working!.data);
      expect(mockRemoteStorage.updateLayout).not.toHaveBeenCalled();
    });

    it("should overwrite non-shared layout and mark as updated when remote storage exists", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE",
        syncInfo: {
          status: "tracked",
          lastRemoteSavedAt: "2023-01-01T00:00:00Z" as ISO8601Timestamp,
        },
        working: {
          data: LayoutBuilder.data(),
          savedAt: "2023-01-01T00:00:00Z" as ISO8601Timestamp,
        },
      });

      // Include the layout in the list results for the cache
      mockLocalStorage.list.mockResolvedValue([localLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });

      // When
      const result = await layoutManager.overwriteLayout({ id: layoutId });

      // Then
      expect(jest.spyOn(mockLocalStorage, "put")).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          id: layoutId,
          baseline: expect.objectContaining({
            data: localLayout.working!.data,
          }),
          working: undefined,
          syncInfo: undefined,
        }),
      );
      expect(result.working).toBe(undefined);
      expect(result.syncInfo?.status).toBe(undefined);
      expect(mockRemoteStorage.updateLayout).not.toHaveBeenCalled();
    });
  });

  describe("revertLayout", () => {
    it("should throw error when layout does not exist", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const layoutId = LayoutBuilder.layoutId();
      mockLocalStorage.get.mockResolvedValue(undefined);

      // When & Then
      await expect(layoutManager.revertLayout({ id: layoutId })).rejects.toThrow(
        `Cannot revert layout id ${layoutId} because it does not exist`,
      );
    });

    it("should revert layout", async () => {
      // Given
      const layoutId = LayoutBuilder.layoutId();
      const existingLayout = LayoutBuilder.layout({
        id: layoutId,
        working: {
          data: LayoutBuilder.data(),
          savedAt: "2023-01-01T00:00:00Z" as ISO8601Timestamp,
        },
      });

      // Include the layout in list results so it gets cached
      mockLocalStorage.list.mockResolvedValue([existingLayout]);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });

      // When
      const result = await layoutManager.revertLayout({ id: layoutId });

      // Then
      expect(result.id).toBe(layoutId);
      expect(result.working).toBe(undefined);
      expect(result.baseline).toEqual(existingLayout.baseline);
      expect(jest.spyOn(mockLocalStorage, "put")).toHaveBeenCalledWith(
        "local",
        expect.objectContaining({
          id: layoutId,
          working: undefined,
        }),
      );
    });
  });

  describe("makePersonalCopy", () => {
    it("should throw error when original layout does not exist", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const originalLayoutId = "non-existent" as LayoutID;
      const copyName = BasicBuilder.string();
      mockLocalStorage.get.mockResolvedValue(undefined);

      // When & Then
      await expect(
        layoutManager.makePersonalCopy({
          id: originalLayoutId,
          name: copyName,
        }),
      ).rejects.toThrow(
        `Cannot make a personal copy of layout id ${originalLayoutId} because it does not exist`,
      );
    });

    it("should make a personal copy", async () => {
      // Given
      const originalLayout = LayoutBuilder.layout({
        name: BasicBuilder.string(),
        permission: "ORG_WRITE",
      });
      originalLayout.working = undefined;
      const copyName = BasicBuilder.string();

      mockLocalStorage.list.mockResolvedValue([originalLayout]);
      mockLocalStorage.put.mockImplementation(async (_namespace: string, layout) => layout);

      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });

      // When
      const result = await layoutManager.makePersonalCopy({
        id: originalLayout.id,
        name: copyName,
      });

      // Then
      expect(result.id).not.toBe(originalLayout.id);
      expect(result.name).toBe(copyName);
      expect(result.permission).toBe("CREATOR_WRITE");
      expect(result.baseline.data).toEqual(originalLayout.baseline.data);
      expect(result.working).toBe(undefined);
      expect(result.syncInfo?.status).toBe("new");
      expect(result.syncInfo?.lastRemoteSavedAt).toBeDefined();
      expect(jest.spyOn(mockLocalStorage, "put")).toHaveBeenCalledTimes(2);
    });
  });

  describe("syncWithRemote", () => {
    it("should do nothing when no remote storage is configured", async () => {
      // Given
      const manager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const abortController = new AbortController();

      // When
      await manager.syncWithRemote(abortController.signal);

      // Then
      expect(jest.spyOn(mockLocalStorage, "list")).not.toHaveBeenCalled();
    });

    it("should do nothing when there is an ongoing sync", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      (layoutManager as any).currentSync = {}; // Simulate ongoing sync
      const abortController = new AbortController();

      // When
      await layoutManager.syncWithRemote(abortController.signal);

      // Then
      expect(jest.spyOn(mockLocalStorage, "list")).not.toHaveBeenCalled();
      expect(mockRemoteStorage.getLayouts).not.toHaveBeenCalled();
    });

    it("should set error on failed sync", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      const syncError = new Error("Sync failed");
      const abortController = new AbortController();

      mockLocalStorage.list.mockRejectedValue(syncError);
      layoutManager.setOnline({ online: true });

      // When & Then
      await expect(layoutManager.syncWithRemote(abortController.signal)).rejects.toThrow(
        "Sync failed",
      );
      expect(layoutManager.error).toBe(syncError);
    });

    it("should clear error on successful sync", async () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: mockRemoteStorage,
      });
      const testError = new Error("Previous error");
      const abortController = new AbortController();

      jest.spyOn(mockLocalStorage, "list").mockResolvedValue([]);
      jest.spyOn(mockRemoteStorage, "getLayouts").mockResolvedValue([]);
      layoutManager.setOnline({ online: true });
      layoutManager.setError(testError);

      // When
      await layoutManager.syncWithRemote(abortController.signal);

      // Then
      expect(layoutManager.error).toBe(undefined);
    });
  });

  describe("isBusy", () => {
    it("should return false when no operations are running", () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });

      // When, Then
      expect(layoutManager.isBusy()).toBe(false);
    });
  });

  describe("event handling", () => {
    it("should support adding and removing event listeners", () => {
      // Given
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
      });
      const mockListener = jest.fn();

      // When
      layoutManager.on("onlinechange", mockListener);
      layoutManager.setOnline({ online: true });
      layoutManager.off("onlinechange", mockListener);
      layoutManager.setOnline({ online: false });

      // Then
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });
});
