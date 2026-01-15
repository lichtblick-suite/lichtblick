// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { ISO8601Timestamp } from "@lichtblick/suite-base/services/ILayoutStorage";
import {
  IRemoteLayoutStorage,
  RemoteLayout,
} from "@lichtblick/suite-base/services/IRemoteLayoutStorage";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { updateOrFetchLayout } from "./updateOrFetchLayouts";

jest.mock("@lichtblick/log", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
  })),
}));

describe("updateOrFetchLayout", () => {
  let mockRemoteStorage: jest.Mocked<IRemoteLayoutStorage>;
  let updateParams: Parameters<IRemoteLayoutStorage["updateLayout"]>[0];
  let remoteLayout: RemoteLayout;

  beforeEach(() => {
    mockRemoteStorage = {
      workspace: BasicBuilder.string(),
      getLayouts: jest.fn(),
      getLayout: jest.fn(),
      saveNewLayout: jest.fn(),
      updateLayout: jest.fn(),
      deleteLayout: jest.fn(),
    };

    updateParams = {
      id: BasicBuilder.string() as LayoutID,
      externalId: BasicBuilder.string(),
      name: BasicBuilder.string(),
      savedAt: new Date().toISOString() as ISO8601Timestamp,
    };

    remoteLayout = LayoutBuilder.remoteLayout({
      id: updateParams.id,
      name: updateParams.name,
    });
  });

  describe("when updateLayout succeeds", () => {
    it("should return the new layout from the successful update", async () => {
      // Given
      const successResponse = {
        status: "success" as const,
        newLayout: remoteLayout,
      };
      mockRemoteStorage.updateLayout.mockResolvedValue(successResponse);

      // When
      const result = await updateOrFetchLayout(mockRemoteStorage, updateParams);

      // Then
      expect(result).toBe(remoteLayout);
      expect(mockRemoteStorage.updateLayout).toHaveBeenCalledWith(updateParams);
      expect(mockRemoteStorage.getLayout).not.toHaveBeenCalled();
    });
  });

  describe("when updateLayout returns conflict", () => {
    beforeEach(() => {
      const conflictResponse = { status: "conflict" as const };
      mockRemoteStorage.updateLayout.mockResolvedValue(conflictResponse);
    });

    it("should fetch and return the server version when conflict occurs", async () => {
      // Given
      mockRemoteStorage.getLayout.mockResolvedValue(remoteLayout);

      // When
      const result = await updateOrFetchLayout(mockRemoteStorage, updateParams);

      // Then
      expect(result).toBe(remoteLayout);
      expect(mockRemoteStorage.updateLayout).toHaveBeenCalledWith(updateParams);
      expect(mockRemoteStorage.getLayout).toHaveBeenCalledWith(updateParams.id);
    });

    it("should throw error when conflict occurs but layout is not found on server", async () => {
      // Given
      mockRemoteStorage.getLayout.mockResolvedValue(undefined);

      // When & Then
      await expect(updateOrFetchLayout(mockRemoteStorage, updateParams)).rejects.toThrow(
        `Update rejected but layout is not present on server: ${updateParams.id}`,
      );
      expect(mockRemoteStorage.updateLayout).toHaveBeenCalledWith(updateParams);
      expect(mockRemoteStorage.getLayout).toHaveBeenCalledWith(updateParams.id);
    });
  });
});
