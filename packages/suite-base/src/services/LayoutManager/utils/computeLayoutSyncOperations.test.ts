// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ISO8601Timestamp, LayoutPermission } from "@lichtblick/suite-base/services/ILayoutStorage";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

import computeLayoutSyncOperations from "./computeLayoutSyncOperations";

jest.mock("@lichtblick/log", () => ({
  getLogger: jest.fn(() => ({
    warn: jest.fn(),
  })),
}));

describe("computeLayoutSyncOperations", () => {
  const layoutId = LayoutBuilder.layoutId();
  const savedAt = "2023-01-01T00:00:00.000Z" as ISO8601Timestamp;

  describe("when local and remote layouts match", () => {
    it("should upload new local layout when sync status is undefined for personal layouts", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE" as LayoutPermission,
      });
      localLayout.syncInfo = undefined;
      const remoteLayout = LayoutBuilder.remoteLayout({ id: layoutId });

      // When
      const operations = computeLayoutSyncOperations([localLayout], [remoteLayout]);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: false,
        type: "upload-new",
        localLayout: expect.objectContaining({ id: layoutId }),
      });
    });

    it("should skip shared layouts when sync status is undefined", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "ORG_WRITE" as LayoutPermission,
      });
      localLayout.syncInfo = undefined;
      const remoteLayout = LayoutBuilder.remoteLayout({ id: layoutId });

      // When
      const operations = computeLayoutSyncOperations([localLayout], [remoteLayout]);

      // Then
      expect(operations).toEqual([]);
    });

    it("should upload new local layout when sync status is new for personal layouts", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE" as LayoutPermission,
        syncInfo: { status: "new", lastRemoteSavedAt: undefined },
      });
      const remoteLayout = LayoutBuilder.remoteLayout({ id: layoutId });

      // When
      const operations = computeLayoutSyncOperations([localLayout], [remoteLayout]);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: false,
        type: "upload-new",
        localLayout: expect.objectContaining({ id: layoutId }),
      });
    });

    it("should upload updated local layout when sync status is updated", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        syncInfo: { status: "updated", lastRemoteSavedAt: savedAt },
      });
      const remoteLayout = LayoutBuilder.remoteLayout({ id: layoutId });

      // When
      const operations = computeLayoutSyncOperations([localLayout], [remoteLayout]);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: false,
        type: "upload-updated",
        localLayout: expect.objectContaining({ id: layoutId }),
      });
    });

    it("should update baseline when remote layout has newer savedAt", () => {
      // Given
      const newerSavedAt = "2023-01-02T00:00:00.000Z" as ISO8601Timestamp;
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        syncInfo: { status: "tracked", lastRemoteSavedAt: savedAt },
      });
      const remoteLayout = LayoutBuilder.remoteLayout({
        id: layoutId,
        savedAt: newerSavedAt,
      });

      // When
      const operations = computeLayoutSyncOperations([localLayout], [remoteLayout]);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: true,
        type: "update-baseline",
        localLayout: expect.objectContaining({ id: layoutId }),
        remoteLayout: expect.objectContaining({ id: layoutId, savedAt: newerSavedAt }),
      });
    });

    it("should not create operations when remote layout is tracked and up to date", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        syncInfo: { status: "tracked", lastRemoteSavedAt: savedAt },
      });
      const remoteLayout = LayoutBuilder.remoteLayout({
        id: layoutId,
        savedAt,
      });

      // When
      const operations = computeLayoutSyncOperations([localLayout], [remoteLayout]);

      // Then
      expect(operations).toEqual([]);
    });

    it("should ignore remote layout without savedAt when status is tracked", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        syncInfo: { status: "tracked", lastRemoteSavedAt: savedAt },
      });
      const remoteLayout = LayoutBuilder.remoteLayout({
        id: layoutId,
      });
      remoteLayout.savedAt = undefined;

      // When
      const operations = computeLayoutSyncOperations([localLayout], [remoteLayout]);

      // Then
      expect(operations).toEqual([]);
    });

    it("should delete remote layout when local is marked as locally-deleted", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE" as LayoutPermission,
        syncInfo: { status: "locally-deleted", lastRemoteSavedAt: savedAt },
      });
      const remoteLayout = LayoutBuilder.remoteLayout({ id: layoutId });

      // When
      const operations = computeLayoutSyncOperations([localLayout], [remoteLayout]);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: false,
        type: "delete-remote",
        localLayout: expect.objectContaining({ id: layoutId }),
      });
    });
  });

  describe("when local layout exists but no matching remote layout", () => {
    it("should NOT upload new personal layout when sync status is undefined", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE" as LayoutPermission,
      });
      localLayout.syncInfo = undefined;

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toHaveLength(0);
    });

    it("should skip shared layouts when sync status is undefined", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "ORG_WRITE" as LayoutPermission,
      });
      localLayout.syncInfo = undefined;

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toEqual([]);
    });

    it("should NOT upload new personal layout when sync status is new", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE" as LayoutPermission,
        syncInfo: { status: "new", lastRemoteSavedAt: undefined },
      });

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toHaveLength(0);
    });

    it("should delete local personal layout when sync status is updated", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE" as LayoutPermission,
        syncInfo: { status: "updated", lastRemoteSavedAt: savedAt },
      });

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: true,
        type: "delete-local",
        localLayout: expect.objectContaining({ id: layoutId }),
      });
    });

    it("should mark shared layout as deleted when sync status is updated", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "ORG_WRITE" as LayoutPermission,
        syncInfo: { status: "updated", lastRemoteSavedAt: savedAt },
      });

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: true,
        type: "mark-deleted",
        localLayout: expect.objectContaining({ id: layoutId }),
      });
    });

    it("should delete local personal layout when sync status is tracked", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE" as LayoutPermission,
        working: undefined,
        syncInfo: { status: "tracked", lastRemoteSavedAt: savedAt },
      });

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: true,
        type: "delete-local",
        localLayout: expect.objectContaining({ id: layoutId }),
      });
    });

    it("should mark shared layout as deleted when sync status is tracked and has working copy", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "ORG_WRITE" as LayoutPermission,
        working: LayoutBuilder.baseline(),
        syncInfo: { status: "tracked", lastRemoteSavedAt: savedAt },
      });

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: true,
        type: "mark-deleted",
        localLayout: expect.objectContaining({ id: layoutId }),
      });
    });

    it("should delete local layout when sync status is locally-deleted", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        permission: "CREATOR_WRITE" as LayoutPermission,
        syncInfo: { status: "locally-deleted", lastRemoteSavedAt: savedAt },
      });

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: true,
        type: "delete-local",
        localLayout: expect.objectContaining({ id: layoutId }),
      });
    });

    it("should delete local layout when sync status is remotely-deleted and no working copy", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        syncInfo: { status: "remotely-deleted", lastRemoteSavedAt: savedAt },
      });
      localLayout.working = undefined;

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: true,
        type: "delete-local",
        localLayout: expect.objectContaining({ id: layoutId, working: undefined }),
      });
    });

    it("should not delete layout when remotely-deleted but has working copy", () => {
      // Given
      const localLayout = LayoutBuilder.layout({
        id: layoutId,
        working: LayoutBuilder.baseline(),
        syncInfo: { status: "remotely-deleted", lastRemoteSavedAt: savedAt },
      });

      // When
      const operations = computeLayoutSyncOperations([localLayout], []);

      // Then
      expect(operations).toEqual([]);
    });
  });

  describe("when remote layout exists but no matching local layout", () => {
    it("should add remote layout to cache", () => {
      // Given
      const remoteLayout = LayoutBuilder.remoteLayout({
        id: layoutId,
      });

      // When
      const operations = computeLayoutSyncOperations([], [remoteLayout]);

      // Then
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        local: true,
        type: "add-to-cache",
        remoteLayout: expect.objectContaining({ id: layoutId }),
      });
    });
  });
});
