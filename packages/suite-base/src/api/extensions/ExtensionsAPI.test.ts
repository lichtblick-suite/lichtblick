// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  CreateOrUpdateResponse,
  ExtensionInfoWorkspace,
} from "@lichtblick/suite-base/api/extensions/types";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import { HttpError } from "@lichtblick/suite-base/services/http/HttpError";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import ExtensionBuilder from "@lichtblick/suite-base/testing/builders/ExtensionBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import ExtensionsAPI from "./ExtensionsAPI";

jest.mock("@lichtblick/suite-base/services/http/HttpService");
jest.mock("@lichtblick/suite-base/constants/config", () => ({
  APP_CONFIG: {
    apiUrl: undefined, // Test without base URL for simplicity
  },
}));

describe("ExtensionsAPI", () => {
  let extensionsAPI: ExtensionsAPI;
  const workspace = BasicBuilder.string();

  const createMockHttpResponse = <T>(data: T) => ({
    data,
    timestamp: new Date().toISOString(),
    path: "/test",
  });

  beforeEach(() => {
    extensionsAPI = new ExtensionsAPI(workspace);
    jest.clearAllMocks();
  });

  it("should initialize with correct workspace", () => {
    expect(extensionsAPI.workspace).toBe(workspace);
  });

  describe("list", () => {
    it("should fetch extensions list", async () => {
      // Given
      const extensions = ExtensionBuilder.extensionsInfo();

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(extensions));
      mockHttpService.get = mockGet;

      // When
      const result = await extensionsAPI.list();

      // Then
      expect(mockGet).toHaveBeenCalledWith(`workspaces/${workspace}/extensions`);
      expect(result.length).toBe(extensions.length);
    });

    it("should handle empty list", async () => {
      // Given
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse([]));
      mockHttpService.get = mockGet;

      // When
      const result = await extensionsAPI.list();

      // Then
      expect(result).toEqual([]);
    });
  });

  describe("get", () => {
    it("should fetch extension by id", async () => {
      // Given
      const extension: StoredExtension = ExtensionBuilder.storedExtension({
        workspace,
      });

      // Create a proper IExtensionApiResponse mock
      const apiResponse = {
        id: "api-" + extension.info.id,
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
        description: extension.info.description,
        displayName: extension.info.displayName,
        extensionId: extension.info.id,
        fileId: extension.fileId ?? "file-123",
        homepage: extension.info.homepage,
        keywords: extension.info.keywords,
        license: extension.info.license,
        name: extension.info.name,
        publisher: extension.info.publisher,
        qualifiedName: extension.info.qualifiedName,
        scope: extension.info.namespace,
        version: extension.info.version,
        changelog: extension.info.changelog,
        readme: extension.info.readme,
      };

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(apiResponse));
      mockHttpService.get = mockGet;

      // When
      const result = await extensionsAPI.get(extension.info.id);

      // Then
      expect(mockGet).toHaveBeenCalledWith(`extensions/${extension.info.id}`);
      expect(result).toEqual({
        info: {
          ...apiResponse,
          id: apiResponse.extensionId,
          externalId: apiResponse.id,
          namespace: apiResponse.scope,
        },
        content: new Uint8Array(),
        workspace,
        fileId: apiResponse.fileId,
        externalId: apiResponse.id,
      } as StoredExtension);
    });

    it("should return undefined when extension not found", async () => {
      // Given
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      mockHttpService.get = mockGet;

      // When
      const result = await extensionsAPI.get("nonexistent");

      // Then
      expect(result).toBeUndefined();
    });
  });

  describe("createOrUpdate", () => {
    it("should create or update extension", async () => {
      // Given
      const extension: ExtensionInfoWorkspace = ExtensionBuilder.extensionInfoWorkspace({
        workspace,
      });

      const mockFile = new File([BasicBuilder.string()], "test.zip", { type: "application/zip" });
      const mockApiResponse: CreateOrUpdateResponse = {
        extension: {
          ...extension.info,
          createdAt: BasicBuilder.datetime(),
          updatedAt: BasicBuilder.datetime(),
          fileId: BasicBuilder.string(),
          extensionId: extension.info.id,
          scope: extension.info.namespace!,
        },
      };
      const mockHttpService = jest.mocked(HttpService);
      const mockPost = jest.fn().mockResolvedValue(createMockHttpResponse(mockApiResponse));
      mockHttpService.post = mockPost;

      // When
      const result = await extensionsAPI.createOrUpdate(extension, mockFile);

      // Then
      expect(mockPost).toHaveBeenCalledWith(
        `workspaces/${workspace}/extension`,
        expect.any(FormData),
      );
      expect(result).toEqual({
        info: {
          ...mockApiResponse.extension,
          id: mockApiResponse.extension.extensionId,
          externalId: mockApiResponse.extension.id,
          namespace: mockApiResponse.extension.scope,
        },
        content: new Uint8Array(),
        workspace,
        fileId: mockApiResponse.extension.fileId,
        externalId: mockApiResponse.extension.id,
      });
    });
  });

  describe("remove", () => {
    it("should remove extension by id", async () => {
      // Given
      const extensionId = BasicBuilder.string();

      const mockHttpService = jest.mocked(HttpService);
      const mockDelete = jest.fn().mockResolvedValue(createMockHttpResponse(true));
      mockHttpService.delete = mockDelete;

      // When
      const result = await extensionsAPI.remove(extensionId);

      // Then
      expect(mockDelete).toHaveBeenCalledWith(`workspaces/${workspace}/extension/${extensionId}`);
      expect(result).toBe(true);
    });

    it("should return false when removal fails", async () => {
      // Given
      const extensionId = BasicBuilder.string();

      const mockHttpService = jest.mocked(HttpService);
      const mockDelete = jest.fn().mockRejectedValue(new HttpError("Not Found", 404, "Not Found"));
      mockHttpService.delete = mockDelete;

      // When
      const result = await extensionsAPI.remove(extensionId);

      // Then
      expect(result).toBe(false);
    });
  });

  describe("loadContent", () => {
    it("should load extension content by file id", async () => {
      // Given
      const id = BasicBuilder.string();
      const mockContent = new ArrayBuffer(8);
      const mockUint8Array = new Uint8Array(mockContent);

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(mockContent));
      mockHttpService.get = mockGet;

      // When
      const result = await extensionsAPI.loadContent(id);

      // Then
      expect(mockGet).toHaveBeenCalledWith(`extensions/${id}/download`, undefined, {
        responseType: "arraybuffer",
      });
      expect(result).toEqual(mockUint8Array);
    });

    it("should return undefined when content not found", async () => {
      // Given
      const fileId = BasicBuilder.string();

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockRejectedValue(new HttpError("Not Found", 404, "Not Found"));
      mockHttpService.get = mockGet;

      // When
      const result = await extensionsAPI.loadContent(fileId);

      // Then
      expect(result).toBeUndefined();
    });

    it("should throw error for other HTTP errors", async () => {
      // Given
      const fileId = BasicBuilder.string();

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest
        .fn()
        .mockRejectedValue(new HttpError("Internal Server Error", 500, "Internal Server Error"));
      mockHttpService.get = mockGet;

      // When Then
      await expect(extensionsAPI.loadContent(fileId)).rejects.toThrow("Internal Server Error");
    });
  });

  describe("error handling", () => {
    it("should propagate HTTP errors", async () => {
      // Given
      const mockError = new Error("Network error");
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockRejectedValue(mockError);
      mockHttpService.get = mockGet;

      // When Then
      await expect(extensionsAPI.list()).rejects.toThrow("Network error");
    });
  });
});
