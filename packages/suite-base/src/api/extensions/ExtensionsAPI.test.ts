// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ExtensionInfoSlug } from "@lichtblick/suite-base/api/extensions/types";
import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

import ExtensionsAPI from "./ExtensionsAPI";

// Mock HttpService
jest.mock("@lichtblick/suite-base/services/http/HttpService");

describe("ExtensionsAPI", () => {
  let extensionsAPI: ExtensionsAPI;
  const mockSlug = "test-slug";

  const createMockExtensionInfo = (id: string, name: string): ExtensionInfo => ({
    id,
    name,
    displayName: `${name} Display`,
    description: `Test ${name}`,
    publisher: "Test Publisher",
    version: "1.0.0",
    keywords: [],
    homepage: "https://example.com",
    license: "MIT",
    qualifiedName: `test-publisher.${id}`,
  });

  const createMockHttpResponse = <T>(data: T) => ({
    data,
    timestamp: new Date().toISOString(),
    path: "/test",
  });

  beforeEach(() => {
    extensionsAPI = new ExtensionsAPI(mockSlug);
    jest.clearAllMocks();
  });

  it("should initialize with correct slug", () => {
    expect(extensionsAPI.slug).toBe(mockSlug);
  });

  describe("list", () => {
    it("should fetch extensions list", async () => {
      const mockExtensions: ExtensionInfo[] = [
        createMockExtensionInfo("ext1", "Extension 1"),
        createMockExtensionInfo("ext2", "Extension 2"),
      ];

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(mockExtensions));
      mockHttpService.get = mockGet;

      const result = await extensionsAPI.list();

      expect(mockGet).toHaveBeenCalledWith("/extensions", { slug: mockSlug });
      expect(result).toEqual(mockExtensions);
    });

    it("should handle empty list", async () => {
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse([]));
      mockHttpService.get = mockGet;

      const result = await extensionsAPI.list();

      expect(result).toEqual([]);
    });
  });

  describe("get", () => {
    it("should fetch extension by id", async () => {
      const mockExtension: StoredExtension = {
        info: createMockExtensionInfo("ext1", "Extension 1"),
        content: new Uint8Array([1, 2, 3]),
        slug: mockSlug,
        fileId: "file123",
      };

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(mockExtension));
      mockHttpService.get = mockGet;

      const result = await extensionsAPI.get("ext1");

      expect(mockGet).toHaveBeenCalledWith(`/extensions/${mockSlug}/ext1`);
      expect(result).toEqual(mockExtension);
    });

    it("should return undefined when extension not found", async () => {
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      mockHttpService.get = mockGet;

      const result = await extensionsAPI.get("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("createOrUpdate", () => {
    it("should create or update extension", async () => {
      const mockExtensionInfo: ExtensionInfoSlug = {
        info: createMockExtensionInfo("ext1", "Extension 1"),
        slug: mockSlug,
      };

      const mockFile = new File(["test content"], "test.zip", { type: "application/zip" });

      const mockStoredExtension: StoredExtension = {
        info: mockExtensionInfo.info,
        content: new Uint8Array([1, 2, 3]),
        slug: mockSlug,
        fileId: "file123",
      };

      const mockHttpService = jest.mocked(HttpService);
      const mockPost = jest.fn().mockResolvedValue(createMockHttpResponse(mockStoredExtension));
      mockHttpService.post = mockPost;

      const result = await extensionsAPI.createOrUpdate(mockExtensionInfo, mockFile);

      expect(mockPost).toHaveBeenCalledWith(`/extensions/${mockSlug}`, expect.any(FormData));
      expect(result).toEqual(mockStoredExtension);
    });
  });

  describe("remove", () => {
    it("should remove extension by id", async () => {
      const mockHttpService = jest.mocked(HttpService);
      const mockDelete = jest.fn().mockResolvedValue(createMockHttpResponse(true));
      mockHttpService.delete = mockDelete;

      const result = await extensionsAPI.remove("ext1");

      expect(mockDelete).toHaveBeenCalledWith("/extensions/ext1");
      expect(result).toBe(true);
    });

    it("should return false when removal fails", async () => {
      const mockHttpService = jest.mocked(HttpService);
      const mockDelete = jest.fn().mockResolvedValue(createMockHttpResponse(false));
      mockHttpService.delete = mockDelete;

      const result = await extensionsAPI.remove("ext1");

      expect(result).toBe(false);
    });
  });

  describe("loadContent", () => {
    it("should load extension content by file id", async () => {
      const mockContent = new Uint8Array([1, 2, 3, 4, 5]);
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(mockContent));
      mockHttpService.get = mockGet;

      const result = await extensionsAPI.loadContent("file123");

      expect(mockGet).toHaveBeenCalledWith("/extensions/file/download/file123");
      expect(result).toEqual(mockContent);
    });

    it("should return undefined when content not found", async () => {
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      mockHttpService.get = mockGet;

      const result = await extensionsAPI.loadContent("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should propagate HTTP errors", async () => {
      const mockError = new Error("Network error");
      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockRejectedValue(mockError);
      mockHttpService.get = mockGet;

      await expect(extensionsAPI.list()).rejects.toThrow("Network error");
    });
  });
});
