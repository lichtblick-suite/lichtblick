// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  UserProfile,
  UserProfileStorage,
} from "@lichtblick/suite-base/context/UserProfileStorageContext";
import { layoutIsFavorite } from "@lichtblick/suite-base/services/ILayoutManager";
import {
  ILayoutStorage,
  ISO8601Timestamp,
  LayoutPermission,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import { IRemoteLayoutFavoritesStorage } from "@lichtblick/suite-base/services/IRemoteLayoutFavoritesStorage";
import { IRemoteLayoutStorage } from "@lichtblick/suite-base/services/IRemoteLayoutStorage";
import LayoutManager from "@lichtblick/suite-base/services/LayoutManager/LayoutManager";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

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

  describe("favorites", () => {
    function makeUserProfileStorage(initial: UserProfile = {}) {
      let profile = initial;
      return {
        profile: () => profile,
        getUserProfile: jest.fn(async () => profile),
        setUserProfile: jest.fn(
          async (update: UserProfile | ((profile: UserProfile) => UserProfile)) => {
            profile = typeof update === "function" ? update(profile) : update;
          },
        ),
      };
    }

    function makeRemoteFavorites(ids: string[] = []): jest.Mocked<IRemoteLayoutFavoritesStorage> {
      return {
        getFavoriteLayoutIds: jest.fn().mockResolvedValue(ids),
        addFavoriteLayout: jest.fn().mockResolvedValue(undefined),
        removeFavoriteLayout: jest.fn().mockResolvedValue(undefined),
      };
    }

    function deferred(): {
      promise: Promise<void>;
      resolve: () => void;
      reject: (e: Error) => void;
    } {
      let resolve: () => void = () => {};
      let reject: (error: Error) => void = () => {};
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    function makeLayoutManager({
      userProfile,
      remoteFavorites,
      online = true,
    }: {
      userProfile?: UserProfileStorage;
      remoteFavorites?: IRemoteLayoutFavoritesStorage;
      online?: boolean;
    }): LayoutManager {
      const layoutManager = new LayoutManager({
        local: mockLocalStorage,
        remote: undefined,
        userProfile,
        remoteFavorites,
      });
      layoutManager.setOnline({ online });
      return layoutManager;
    }

    const personalLayout = () => LayoutBuilder.layout({ permission: "CREATOR_WRITE" });
    const sharedLayout = () =>
      LayoutBuilder.layout({ permission: "ORG_WRITE", externalId: BasicBuilder.string() });

    describe("getFavorites", () => {
      it("should load personal favorites from the user profile", async () => {
        // Given
        const layout = personalLayout();
        const layoutManager = makeLayoutManager({
          userProfile: makeUserProfileStorage({ favoriteLayoutIds: [layout.id] }),
        });

        // When
        const favorites = await layoutManager.getFavorites();

        // Then
        expect(layoutIsFavorite(favorites, layout)).toBe(true);
        expect(layoutIsFavorite(favorites, personalLayout())).toBe(false);
      });

      it("should load shared favorites when online", async () => {
        // Given
        const layout = sharedLayout();
        const layoutManager = makeLayoutManager({
          remoteFavorites: makeRemoteFavorites([layout.externalId!]),
        });

        // When
        const favorites = await layoutManager.getFavorites();

        // Then
        expect(layoutIsFavorite(favorites, layout)).toBe(true);
        expect(layoutIsFavorite(favorites, sharedLayout())).toBe(false);
      });

      it("should not load shared favorites while offline", async () => {
        // Given
        const remoteFavorites = makeRemoteFavorites();
        const layoutManager = makeLayoutManager({ remoteFavorites, online: false });

        // When
        await layoutManager.getFavorites();

        // Then
        expect(remoteFavorites.getFavoriteLayoutIds).not.toHaveBeenCalled();
      });

      it("should load shared favorites once the layout manager goes online", async () => {
        // Given
        const layout = sharedLayout();
        const layoutManager = makeLayoutManager({
          remoteFavorites: makeRemoteFavorites([layout.externalId!]),
          online: false,
        });

        // When
        layoutManager.setOnline({ online: true });
        const favorites = await layoutManager.getFavorites();

        // Then
        expect(layoutIsFavorite(favorites, layout)).toBe(true);
      });

      it("should have no shared favorites when they cannot be loaded", async () => {
        // Given
        const remoteFavorites = makeRemoteFavorites();
        remoteFavorites.getFavoriteLayoutIds.mockRejectedValue(new Error("Not Found"));
        const layoutManager = makeLayoutManager({ remoteFavorites });

        // When
        const favorites = await layoutManager.getFavorites();

        // Then
        expect(favorites.shared.size).toBe(0);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to load remote favorite layouts"),
          expect.any(Error),
        );
        (console.error as jest.Mock).mockClear();
      });

      it("should ignore an older load that finishes after a newer one", async () => {
        // Given two loads in progress
        const remoteFavorites = makeRemoteFavorites();
        let resolveOlder: (ids: string[]) => void = () => {};
        let resolveNewer: (ids: string[]) => void = () => {};
        remoteFavorites.getFavoriteLayoutIds
          .mockReturnValueOnce(new Promise((res) => (resolveOlder = res)))
          .mockReturnValueOnce(new Promise((res) => (resolveNewer = res)));
        const layoutManager = makeLayoutManager({ remoteFavorites });
        layoutManager.setOnline({ online: true });

        // When the newer load finishes first
        resolveNewer(["new"]);
        await layoutManager.getFavorites();
        resolveOlder(["old"]);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Then the newer favorites are kept
        expect([...layoutManager.favorites.shared]).toEqual(["new"]);
      });

      it("should apply an older load when a newer one fails", async () => {
        // Given two loads in progress
        const remoteFavorites = makeRemoteFavorites();
        let resolveOlder: (ids: string[]) => void = () => {};
        let rejectNewer: (error: Error) => void = () => {};
        remoteFavorites.getFavoriteLayoutIds
          .mockReturnValueOnce(new Promise((res) => (resolveOlder = res)))
          .mockReturnValueOnce(new Promise((_res, rej) => (rejectNewer = rej)));
        const layoutManager = makeLayoutManager({ remoteFavorites });
        layoutManager.setOnline({ online: true });

        // When the newer load fails and the older one then finishes
        rejectNewer(new Error("Not Found"));
        await layoutManager.getFavorites();
        resolveOlder(["old"]);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Then the older favorites are applied
        expect([...layoutManager.favorites.shared]).toEqual(["old"]);
        (console.error as jest.Mock).mockClear();
      });

      it("should emit favoriteschange when favorites are loaded", async () => {
        // Given
        const layoutManager = makeLayoutManager({
          userProfile: makeUserProfileStorage({ favoriteLayoutIds: [personalLayout().id] }),
        });
        const listener = jest.fn();
        layoutManager.on("favoriteschange", listener);

        // When
        await layoutManager.getFavorites();

        // Then
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe("canFavorite", () => {
      it("should allow personal layouts only with a user profile storage", () => {
        // Given
        const withProfile = makeLayoutManager({ userProfile: makeUserProfileStorage() });
        const withoutProfile = makeLayoutManager({});

        // When, Then
        expect(withProfile.canFavorite(personalLayout())).toBe(true);
        expect(withoutProfile.canFavorite(personalLayout())).toBe(false);
      });

      it("should allow shared layouts only with remote favorites storage", () => {
        // Given
        const withRemote = makeLayoutManager({ remoteFavorites: makeRemoteFavorites() });
        const withoutRemote = makeLayoutManager({ userProfile: makeUserProfileStorage() });

        // When, Then
        expect(withRemote.canFavorite(sharedLayout())).toBe(true);
        expect(withoutRemote.canFavorite(sharedLayout())).toBe(false);
      });

      it("should not allow a shared layout without an external id", () => {
        // Given
        const layoutManager = makeLayoutManager({ remoteFavorites: makeRemoteFavorites() });

        // When, Then
        expect(layoutManager.canFavorite({ ...sharedLayout(), externalId: undefined })).toBe(false);
      });
    });

    describe("setFavorite for personal layouts", () => {
      it("should save added and removed favorites in the user profile", async () => {
        // Given
        const layout = personalLayout();
        const userProfile = makeUserProfileStorage();
        const layoutManager = makeLayoutManager({ userProfile });

        // When
        await layoutManager.setFavorite(layout, { favorite: true });

        // Then
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(true);
        expect(userProfile.profile().favoriteLayoutIds).toEqual([layout.id]);

        // When
        await layoutManager.setFavorite(layout, { favorite: false });

        // Then
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(false);
        expect(userProfile.profile().favoriteLayoutIds).toEqual([]);
      });

      it("should apply a change made while loading on top of the stored favorites", async () => {
        // Given
        const stored = personalLayout();
        const layout = personalLayout();
        const userProfile = makeUserProfileStorage({ favoriteLayoutIds: [stored.id] });
        const load = deferred();
        userProfile.getUserProfile.mockImplementationOnce(async () => {
          await load.promise;
          return userProfile.profile();
        });
        const layoutManager = makeLayoutManager({ userProfile });

        // When
        const adding = layoutManager.setFavorite(layout, { favorite: true });
        load.resolve();
        await adding;

        // Then
        expect(layoutManager.favorites.personal).toEqual(new Set([stored.id, layout.id]));
      });

      it("should roll back a change that cannot be saved", async () => {
        // Given
        const layout = personalLayout();
        const userProfile = makeUserProfileStorage();
        userProfile.setUserProfile.mockRejectedValue(new Error("Quota exceeded"));
        const layoutManager = makeLayoutManager({ userProfile });

        // When
        const adding = layoutManager.setFavorite(layout, { favorite: true });

        // Then
        await expect(adding).rejects.toThrow("Quota exceeded");
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(false);
      });

      it("should roll back to the previous change when a later one fails", async () => {
        // Given
        const layout = personalLayout();
        const userProfile = makeUserProfileStorage();
        const layoutManager = makeLayoutManager({ userProfile });
        await layoutManager.setFavorite(layout, { favorite: true });
        userProfile.setUserProfile.mockRejectedValueOnce(new Error("Quota exceeded"));

        // When
        const removing = layoutManager.setFavorite(layout, { favorite: false });

        // Then
        await expect(removing).rejects.toThrow("Quota exceeded");
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(true);
      });

      it("should only roll back the layout whose write failed", async () => {
        // Given a pending write of a first layout
        const first = personalLayout();
        const second = personalLayout();
        const userProfile = makeUserProfileStorage();
        const firstWrite = deferred();
        userProfile.setUserProfile.mockReturnValueOnce(firstWrite.promise);
        const layoutManager = makeLayoutManager({ userProfile });
        await layoutManager.getFavorites();
        const addingFirst = layoutManager.setFavorite(first, { favorite: true });

        // When a second layout is saved, and then the first write fails
        await layoutManager.setFavorite(second, { favorite: true });
        firstWrite.reject(new Error("Quota exceeded"));

        // Then only the first layout is rolled back
        await expect(addingFirst).rejects.toThrow("Quota exceeded");
        expect(layoutIsFavorite(layoutManager.favorites, first)).toBe(false);
        expect(layoutIsFavorite(layoutManager.favorites, second)).toBe(true);
      });

      it("should save the writes of a layout in order", async () => {
        // Given a pending write that adds a layout
        const layout = personalLayout();
        const userProfile = makeUserProfileStorage();
        const addWrite = deferred();
        userProfile.setUserProfile.mockReturnValueOnce(addWrite.promise);
        const layoutManager = makeLayoutManager({ userProfile });
        await layoutManager.getFavorites();
        const adding = layoutManager.setFavorite(layout, { favorite: true });

        // When removing it before the first write finishes
        const removing = layoutManager.setFavorite(layout, { favorite: false });
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Then the removal waits for the first write
        expect(userProfile.setUserProfile).toHaveBeenCalledTimes(1);
        addWrite.resolve();
        await adding;
        await removing;
        expect(userProfile.setUserProfile).toHaveBeenCalledTimes(2);
        expect(userProfile.profile().favoriteLayoutIds).toEqual([]);
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(false);
      });

      it("should roll back to the saved state when consecutive writes of a layout fail", async () => {
        // Given two writes of the same layout
        const layout = personalLayout();
        const userProfile = makeUserProfileStorage();
        const addWrite = deferred();
        userProfile.setUserProfile
          .mockReturnValueOnce(addWrite.promise)
          .mockRejectedValueOnce(new Error("Quota exceeded"));
        const layoutManager = makeLayoutManager({ userProfile });
        await layoutManager.getFavorites();
        const adding = layoutManager.setFavorite(layout, { favorite: true });
        const removing = layoutManager.setFavorite(layout, { favorite: false });

        // When both writes fail
        addWrite.reject(new Error("Quota exceeded"));
        await expect(adding).rejects.toThrow("Quota exceeded");
        await expect(removing).rejects.toThrow("Quota exceeded");

        // Then the layout keeps its saved state
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(false);
      });

      it("should not use the remote favorites storage", async () => {
        // Given
        const remoteFavorites = makeRemoteFavorites();
        const layoutManager = makeLayoutManager({
          userProfile: makeUserProfileStorage(),
          remoteFavorites,
        });

        // When
        await layoutManager.setFavorite(personalLayout(), { favorite: true });

        // Then
        expect(remoteFavorites.addFavoriteLayout).not.toHaveBeenCalled();
      });

      it("should throw without a user profile storage", async () => {
        // Given
        const layoutManager = makeLayoutManager({ remoteFavorites: makeRemoteFavorites() });

        // When, Then
        await expect(
          layoutManager.setFavorite(personalLayout(), { favorite: true }),
        ).rejects.toThrow("cannot be marked as favorite");
      });

      it("should not make a shared layout with the same id a favorite", async () => {
        // Given
        const id = BasicBuilder.string();
        const personal = LayoutBuilder.layout({ id: id as LayoutID, permission: "CREATOR_WRITE" });
        const shared = LayoutBuilder.layout({
          id: id as LayoutID,
          permission: "ORG_READ",
          externalId: id,
        });
        const layoutManager = makeLayoutManager({
          userProfile: makeUserProfileStorage(),
          remoteFavorites: makeRemoteFavorites(),
        });

        // When
        await layoutManager.setFavorite(personal, { favorite: true });

        // Then
        expect(layoutIsFavorite(layoutManager.favorites, personal)).toBe(true);
        expect(layoutIsFavorite(layoutManager.favorites, shared)).toBe(false);
      });
    });

    describe("setFavorite for shared layouts", () => {
      it("should add and remove favorites through the remote storage by external id", async () => {
        // Given
        const layout = sharedLayout();
        const remoteFavorites = makeRemoteFavorites();
        const layoutManager = makeLayoutManager({ remoteFavorites });

        // When
        await layoutManager.setFavorite(layout, { favorite: true });

        // Then
        expect(remoteFavorites.addFavoriteLayout).toHaveBeenCalledWith(layout.externalId);
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(true);

        // When
        await layoutManager.setFavorite(layout, { favorite: false });

        // Then
        expect(remoteFavorites.removeFavoriteLayout).toHaveBeenCalledWith(layout.externalId);
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(false);
      });

      it("should emit favoriteschange before the change is saved", () => {
        // Given
        const layoutManager = makeLayoutManager({ remoteFavorites: makeRemoteFavorites() });
        const listener = jest.fn();
        layoutManager.on("favoriteschange", listener);

        // When
        void layoutManager.setFavorite(sharedLayout(), { favorite: true });

        // Then
        expect(listener).toHaveBeenCalledTimes(1);
      });

      it("should roll back a change that cannot be saved", async () => {
        // Given
        const layout = sharedLayout();
        const remoteFavorites = makeRemoteFavorites();
        remoteFavorites.addFavoriteLayout.mockRejectedValue(new Error("Forbidden"));
        const layoutManager = makeLayoutManager({ remoteFavorites });

        // When
        const adding = layoutManager.setFavorite(layout, { favorite: true });

        // Then
        await expect(adding).rejects.toThrow("Forbidden");
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(false);
      });

      it("should send the writes of a layout in order", async () => {
        // Given
        const layout = sharedLayout();
        const remoteFavorites = makeRemoteFavorites();
        const add = deferred();
        remoteFavorites.addFavoriteLayout.mockReturnValueOnce(add.promise);
        const layoutManager = makeLayoutManager({ remoteFavorites });
        const adding = layoutManager.setFavorite(layout, { favorite: true });

        // When
        const removing = layoutManager.setFavorite(layout, { favorite: false });
        await Promise.resolve();

        // Then
        expect(remoteFavorites.addFavoriteLayout).toHaveBeenCalledWith(layout.externalId);
        expect(remoteFavorites.removeFavoriteLayout).not.toHaveBeenCalled();
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(false);

        // When
        add.resolve();
        await Promise.all([adding, removing]);

        // Then
        expect(remoteFavorites.removeFavoriteLayout).toHaveBeenCalledWith(layout.externalId);
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(false);
      });

      it("should not delay the write of another layout", async () => {
        // Given
        const first = sharedLayout();
        const second = sharedLayout();
        const remoteFavorites = makeRemoteFavorites();
        const add = deferred();
        remoteFavorites.addFavoriteLayout.mockReturnValueOnce(add.promise);
        const layoutManager = makeLayoutManager({ remoteFavorites });
        const addingFirst = layoutManager.setFavorite(first, { favorite: true });

        // When
        await layoutManager.setFavorite(second, { favorite: true });

        // Then
        expect(remoteFavorites.addFavoriteLayout).toHaveBeenCalledWith(second.externalId);
        expect(layoutIsFavorite(layoutManager.favorites, second)).toBe(true);
        add.resolve();
        await addingFirst;
        expect(layoutIsFavorite(layoutManager.favorites, first)).toBe(true);
      });

      it("should only roll back the layout whose write failed", async () => {
        // Given
        const first = sharedLayout();
        const second = sharedLayout();
        const remoteFavorites = makeRemoteFavorites();
        const add = deferred();
        remoteFavorites.addFavoriteLayout.mockReturnValueOnce(add.promise);
        const layoutManager = makeLayoutManager({ remoteFavorites });
        const addingFirst = layoutManager.setFavorite(first, { favorite: true });
        await layoutManager.setFavorite(second, { favorite: true });

        // When
        add.reject(new Error("Forbidden"));

        // Then
        await expect(addingFirst).rejects.toThrow("Forbidden");
        expect(layoutIsFavorite(layoutManager.favorites, first)).toBe(false);
        expect(layoutIsFavorite(layoutManager.favorites, second)).toBe(true);
      });

      it("should roll back to the saved state when consecutive writes fail", async () => {
        // Given
        const layout = sharedLayout();
        const remoteFavorites = makeRemoteFavorites();
        remoteFavorites.addFavoriteLayout.mockRejectedValue(new Error("Forbidden"));
        remoteFavorites.removeFavoriteLayout.mockRejectedValue(new Error("Forbidden"));
        const layoutManager = makeLayoutManager({ remoteFavorites });

        // When
        const adding = layoutManager.setFavorite(layout, { favorite: true });
        const removing = layoutManager.setFavorite(layout, { favorite: false });

        // Then
        await expect(adding).rejects.toThrow("Forbidden");
        await expect(removing).rejects.toThrow("Forbidden");
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(false);
      });

      it("should keep a pending change when shared favorites are reloaded", async () => {
        // Given
        const layout = sharedLayout();
        const remoteFavorites = makeRemoteFavorites();
        const add = deferred();
        remoteFavorites.addFavoriteLayout.mockReturnValueOnce(add.promise);
        const layoutManager = makeLayoutManager({ remoteFavorites });
        await layoutManager.getFavorites();
        const adding = layoutManager.setFavorite(layout, { favorite: true });

        // When
        layoutManager.setOnline({ online: true });
        await layoutManager.getFavorites();

        // Then
        expect(layoutIsFavorite(layoutManager.favorites, layout)).toBe(true);
        add.resolve();
        await adding;
      });

      describe("when a layout changes while shared favorites load", () => {
        function deferredIds(): { promise: Promise<string[]>; resolve: (ids: string[]) => void } {
          let resolve: (ids: string[]) => void = () => {};
          const promise = new Promise<string[]>((res) => {
            resolve = res;
          });
          return { promise, resolve };
        }

        const sharedLayoutWithId = (externalId: string) =>
          LayoutBuilder.layout({ permission: "ORG_WRITE", externalId });

        it("should keep the loaded favorites of the other layouts", async () => {
          // Given a load in progress of favorites "a" and "b"
          const remoteFavorites = makeRemoteFavorites();
          const load = deferredIds();
          remoteFavorites.getFavoriteLayoutIds.mockReturnValueOnce(load.promise);
          const layoutManager = makeLayoutManager({ remoteFavorites });

          // When "c" is marked as favorite before the load finishes
          await layoutManager.setFavorite(sharedLayoutWithId("c"), { favorite: true });
          load.resolve(["a", "b"]);
          const favorites = await layoutManager.getFavorites();

          // Then the loaded favorites are kept alongside the change
          expect([...favorites.shared].sort()).toEqual(["a", "b", "c"]);
        });

        it("should roll back later failed writes to the loaded favorites", async () => {
          // Given favorites "a" loaded while "c" was being marked as favorite
          const remoteFavorites = makeRemoteFavorites();
          const load = deferredIds();
          remoteFavorites.getFavoriteLayoutIds.mockReturnValueOnce(load.promise);
          const layoutManager = makeLayoutManager({ remoteFavorites });
          await layoutManager.setFavorite(sharedLayoutWithId("c"), { favorite: true });
          load.resolve(["a"]);
          await layoutManager.getFavorites();

          // When removing "a" fails
          remoteFavorites.removeFavoriteLayout.mockRejectedValueOnce(new Error("Forbidden"));
          await expect(
            layoutManager.setFavorite(sharedLayoutWithId("a"), { favorite: false }),
          ).rejects.toThrow("Forbidden");

          // Then "a" is rolled back to the loaded state
          expect(layoutManager.favorites.shared.has("a")).toBe(true);
        });

        it("should keep a write saved during the load when the response predates it", async () => {
          // Given a load whose response was produced before "c" was saved
          const remoteFavorites = makeRemoteFavorites();
          const load = deferredIds();
          remoteFavorites.getFavoriteLayoutIds.mockReturnValueOnce(load.promise);
          const layoutManager = makeLayoutManager({ remoteFavorites });

          // When "c" is saved as favorite and the load then finishes without it
          await layoutManager.setFavorite(sharedLayoutWithId("c"), { favorite: true });
          load.resolve([]);
          const favorites = await layoutManager.getFavorites();

          // Then "c" stays a favorite
          expect(favorites.shared.has("c")).toBe(true);
        });

        it("should follow the loaded favorites for a write that failed during the load", async () => {
          // Given a load in progress, and the server already has "c" as favorite
          const remoteFavorites = makeRemoteFavorites();
          const load = deferredIds();
          remoteFavorites.getFavoriteLayoutIds.mockReturnValueOnce(load.promise);
          remoteFavorites.removeFavoriteLayout.mockRejectedValueOnce(new Error("Forbidden"));
          const layoutManager = makeLayoutManager({ remoteFavorites });

          // When removing "c" fails before the load finishes
          await expect(
            layoutManager.setFavorite(sharedLayoutWithId("c"), { favorite: false }),
          ).rejects.toThrow("Forbidden");
          load.resolve(["c"]);
          const favorites = await layoutManager.getFavorites();

          // Then "c" follows the server state
          expect(favorites.shared.has("c")).toBe(true);
        });
      });

      it("should throw without remote favorites storage", async () => {
        // Given
        const layoutManager = makeLayoutManager({ userProfile: makeUserProfileStorage() });

        // When, Then
        await expect(layoutManager.setFavorite(sharedLayout(), { favorite: true })).rejects.toThrow(
          "cannot be marked as favorite",
        );
      });
    });
  });
});
