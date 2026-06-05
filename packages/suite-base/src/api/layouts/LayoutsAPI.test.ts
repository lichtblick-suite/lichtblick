// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  LayoutApiData,
  SaveNewLayoutParams,
  WorkspaceLayoutResponse,
} from "@lichtblick/suite-base/api/layouts/types";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { BasicBuilder } from "@lichtblick/test-builders";

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
    expect(layoutsAPI.workspacePath).toBe("workspaces");
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
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
      ];

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(mockApiResponse));
      mockHttpService.get = mockGet;

      const result = await layoutsAPI.getLayouts();

      expect(mockGet).toHaveBeenCalledWith(`workspaces/${mockWorkspace}/layouts`);

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
      const mockSaveRequest: SaveNewLayoutParams = {
        id: BasicBuilder.string() as LayoutID,
        name: BasicBuilder.string(),
        data: {
          configById: {},
          globalVariables: {},
          playbackConfig: { speed: 1 },
          userNodes: {},
        },
        permission: "CREATOR_WRITE",
      };

      const mockLayoutData: LayoutApiData = {
        id: `external-${mockSaveRequest.id}`,
        layoutId: mockSaveRequest.id,
        name: mockSaveRequest.name,
        data: mockSaveRequest.data,
        permission: mockSaveRequest.permission,
        from: BasicBuilder.string(),
        workspace: mockWorkspace,
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      };

      const mockApiResponse: WorkspaceLayoutResponse = {
        layout: mockLayoutData,
      };

      const mockHttpService = jest.mocked(HttpService);
      const mockPost = jest.fn().mockResolvedValue(createMockHttpResponse(mockApiResponse));
      mockHttpService.post = mockPost;

      const result = await layoutsAPI.saveNewLayout(mockSaveRequest);

      expect(mockPost).toHaveBeenCalledWith(
        `workspaces/${mockWorkspace}/layout`,
        expect.objectContaining({
          layoutId: mockSaveRequest.id,
          name: mockSaveRequest.name,
          permission: mockSaveRequest.permission,
        }),
      );
      expect(result.name).toBe(mockSaveRequest.name);
      expect(result.id).toBe(mockSaveRequest.id);
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
        updatedAt: "2023-01-01T00:00:00.000Z",
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

      expect(mockDelete).toHaveBeenCalledWith(`workspaces/${mockWorkspace}/layout/external-123`);
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

  describe("getDefaultLayoutData", () => {
    it("should return layout data when the server responds with 200", async () => {
      const mockLayoutData = {
        configById: { panel1: { foo: "bar" } },
        globalVariables: { myVar: 42 },
        userNodes: { scriptA: { name: "scriptA", sourceCode: "// hello" } },
        playbackConfig: { speed: 2 },
      };
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(mockLayoutData));
      mockHttpService.get = mockGet;

      const result = await layoutsAPI.getDefaultLayoutData();

      expect(mockGet).toHaveBeenCalledWith(`workspaces/${mockWorkspace}/layouts/default_data`);
      expect(result).toEqual(mockLayoutData);
    });

    it("should return partial layout data when the server responds with sparse defaults", async () => {
      // Given
      const partialLayoutData = {
        playbackConfig: { speed: 2 },
      };
      const mockHttpService = jest.mocked(HttpService);
      mockHttpService.get = jest.fn().mockResolvedValue(createMockHttpResponse(partialLayoutData));

      // When
      const result = await layoutsAPI.getDefaultLayoutData();

      // Then
      expect(result).toEqual(partialLayoutData);
    });

    it("should return undefined when the server responds with 404", async () => {
      const { HttpError } = await import("@lichtblick/suite-base/services/http/HttpError");
      const notFoundError = new HttpError("Not Found", 404, "Not Found");
      const mockHttpService = jest.mocked(HttpService);
      mockHttpService.get = jest.fn().mockRejectedValue(notFoundError);

      const result = await layoutsAPI.getDefaultLayoutData();

      expect(result).toBeUndefined();
    });

    it("should rethrow HttpError when the status is not 404", async () => {
      const { HttpError } = await import("@lichtblick/suite-base/services/http/HttpError");
      const serverError = new HttpError("Internal Server Error", 500, "Internal Server Error");
      const mockHttpService = jest.mocked(HttpService);
      mockHttpService.get = jest.fn().mockRejectedValue(serverError);

      await expect(layoutsAPI.getDefaultLayoutData()).rejects.toThrow("Internal Server Error");
    });

    it("should rethrow non-HttpError errors", async () => {
      const networkError = new Error("Network failure");
      const mockHttpService = jest.mocked(HttpService);
      mockHttpService.get = jest.fn().mockRejectedValue(networkError);

      await expect(layoutsAPI.getDefaultLayoutData()).rejects.toThrow("Network failure");
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
