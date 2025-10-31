// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import HttpService from "@lichtblick/suite-base/services/http/HttpService";

import { LayoutsAPI } from "./LayoutsAPI";

// Mock HttpService
jest.mock("@lichtblick/suite-base/services/http/HttpService");

describe("LayoutsAPI", () => {
  let layoutsAPI: LayoutsAPI;
  const mockWorkspace = "test-workspace";

  const createMockHttpResponse = <T>(data: T) => ({
    data,
    timestamp: new Date().toISOString(),
    path: "/test",
  });

  beforeEach(() => {
    layoutsAPI = new LayoutsAPI(mockWorkspace);
    jest.clearAllMocks();
  });

  it("should initialize with correct workspace and baseUrl", () => {
    expect(layoutsAPI.workspace).toBe(mockWorkspace);
    expect(layoutsAPI.baseUrl).toBe("layouts");
  });

  describe("getLayouts", () => {
    it("should fetch and transform layouts", async () => {
      const mockApiResponse = [
        {
          id: "external-1",
          layoutId: "1" as any,
          name: "Layout 1",
          data: {
            configById: {},
            globalVariables: {},
            playbackConfig: { speed: 1 },
            userNodes: {},
          },
          permission: "CREATOR_WRITE" as any,
          updatedBy: "2023-01-01T00:00:00.000Z",
        },
      ];

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(mockApiResponse));
      mockHttpService.get = mockGet;

      const result = await layoutsAPI.getLayouts();

      expect(mockGet).toHaveBeenCalledWith("layouts", { workspace: mockWorkspace });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("1");
      expect(result[0]?.name).toBe("Layout 1");
    });

    it("should handle empty layouts list", async () => {
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse([]));
      mockHttpService.get = mockGet;

      const result = await layoutsAPI.getLayouts();

      expect(result).toEqual([]);
    });
  });

  describe("getLayout", () => {
    it("should throw not implemented error", async () => {
      await expect(layoutsAPI.getLayout()).rejects.toThrow("Method not implemented.");
    });
  });

  describe("saveNewLayout", () => {
    it("should save new layout and transform response", async () => {
      const mockSaveRequest = {
        id: "new-layout" as any,
        name: "New Layout",
        data: {
          configById: {},
          globalVariables: {},
          playbackConfig: { speed: 1 },
          userNodes: {},
        },
        permission: "CREATOR_WRITE" as any,
        externalId: "external-id",
        savedAt: "2023-01-01T00:00:00.000Z" as any,
      };

      const mockApiResponse = {
        id: "external-new-layout",
        layoutId: "new-layout" as any,
        name: "New Layout",
        data: mockSaveRequest.data,
        permission: "CREATOR_WRITE" as any,
        updatedBy: "2023-01-01T00:00:00.000Z",
      };

      const mockHttpService = jest.mocked(HttpService);
      const mockPost = jest.fn().mockResolvedValue(createMockHttpResponse(mockApiResponse));
      mockHttpService.post = mockPost;

      const result = await layoutsAPI.saveNewLayout(mockSaveRequest);

      expect(mockPost).toHaveBeenCalledWith(
        "layouts",
        expect.objectContaining({
          layoutId: "new-layout",
          name: "New Layout",
          workspace: mockWorkspace,
        }),
      );

      expect(result.name).toBe("New Layout");
      expect(result.id).toBe("new-layout");
    });
  });

  describe("updateLayout", () => {
    it("should update layout and return success response", async () => {
      const mockUpdateRequest = {
        id: "123" as any,
        externalId: "external-123",
        name: "Updated Layout",
        data: {
          configById: {},
          globalVariables: {},
          playbackConfig: { speed: 1 },
          userNodes: {},
        },
        permission: "ORG_READ" as any,
        savedAt: "2023-01-01T00:00:00.000Z" as any,
      };

      const mockApiResponse = {
        id: "external-123",
        layoutId: "123" as any,
        name: "Updated Layout",
        data: mockUpdateRequest.data,
        permission: "ORG_READ" as any,
        updatedBy: "2023-01-01T00:00:00.000Z",
      };

      const mockHttpService = jest.mocked(HttpService);
      const mockPut = jest.fn().mockResolvedValue(createMockHttpResponse(mockApiResponse));
      mockHttpService.put = mockPut;

      const result = await layoutsAPI.updateLayout(mockUpdateRequest);

      expect(mockPut).toHaveBeenCalledWith(
        "layouts/external-123",
        expect.objectContaining({
          name: "Updated Layout",
          permission: "ORG_READ",
        }),
      );

      expect(result.status).toBe("success");
      // Type narrowing for success case
      expect((result as any).newLayout?.name).toBe("Updated Layout");
    });
  });

  describe("deleteLayout", () => {
    it("should delete layout and return true when successful", async () => {
      const mockDeletedLayout = {
        id: "123" as any,
        externalId: "external-123",
        name: "Deleted Layout",
        data: {
          configById: {},
          globalVariables: {},
          playbackConfig: { speed: 1 },
          userNodes: {},
        },
        permission: "CREATOR_WRITE" as any,
        savedAt: "2023-01-01T00:00:00.000Z" as any,
      };

      const mockHttpService = jest.mocked(HttpService);
      const mockDelete = jest.fn().mockResolvedValue(createMockHttpResponse(mockDeletedLayout));
      mockHttpService.delete = mockDelete;

      const result = await layoutsAPI.deleteLayout("external-123");

      expect(mockDelete).toHaveBeenCalledWith("layouts/external-123");
      expect(result).toBe(true);
    });

    it("should return false when deletion fails", async () => {
      const mockHttpService = jest.mocked(HttpService);
      const mockDelete = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      mockHttpService.delete = mockDelete;

      const result = await layoutsAPI.deleteLayout("external-123");

      expect(result).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should propagate HTTP errors from getLayouts", async () => {
      const mockError = new Error("Network error");
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockRejectedValue(mockError);
      mockHttpService.get = mockGet;

      await expect(layoutsAPI.getLayouts()).rejects.toThrow("Network error");
    });

    it("should propagate HTTP errors from deleteLayout", async () => {
      const mockError = new Error("Delete failed");
      const mockHttpService = jest.mocked(HttpService);
      const mockDelete = jest.fn().mockRejectedValue(mockError);
      mockHttpService.delete = mockDelete;

      await expect(layoutsAPI.deleteLayout("external-123")).rejects.toThrow("Delete failed");
    });
  });
});
