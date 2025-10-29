// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import JSZip from "jszip";

import ExtensionsAPI from "@lichtblick/suite-base/api/extensions/ExtensionsAPI";
import { ALLOWED_FILES } from "@lichtblick/suite-base/services/extension/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import ExtensionBuilder from "@lichtblick/suite-base/testing/builders/ExtensionBuilder";
import { Namespace } from "@lichtblick/suite-base/types";

import { RemoteExtensionLoader } from "./RemoteExtensionLoader";

jest.mock("@lichtblick/suite-base/api/extensions/ExtensionsAPI");
jest.mock("@lichtblick/log", () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
  })),
}));

const MockedExtensionsAPI = ExtensionsAPI as jest.MockedClass<typeof ExtensionsAPI>;

describe("RemoteExtensionLoader", () => {
  let mockExtensionsAPI: jest.Mocked<ExtensionsAPI>;
  let loader: RemoteExtensionLoader;
  const mockNamespace: Namespace = "org";
  const workspace = BasicBuilder.string();

  beforeEach(() => {
    mockExtensionsAPI = {
      list: jest.fn(),
      get: jest.fn(),
      loadContent: jest.fn(),
      createOrUpdate: jest.fn(),
      remove: jest.fn(),
      workspace,
    } as any;

    MockedExtensionsAPI.mockImplementation(() => mockExtensionsAPI);
    loader = new RemoteExtensionLoader(mockNamespace, workspace);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Given a RemoteExtensionLoader instance", () => {
    it("When constructing the loader, Then should initialize with correct namespace and workspace", () => {
      // Given
      // When
      // Then
      expect(loader.namespace).toBe(mockNamespace);
      expect(loader.workspace).toBe(workspace);
      expect(MockedExtensionsAPI).toHaveBeenCalledWith(workspace);
    });
  });

  describe("getExtension", () => {
    it("When getting an existing extension, Then should return extension info", async () => {
      // Given
      const extensionId = BasicBuilder.string();
      const mockExtensionInfo = ExtensionBuilder.extensionInfo({ id: extensionId });
      const mockStoredExtension = ExtensionBuilder.storedExtension({ info: mockExtensionInfo });
      const getSpy = jest.spyOn(mockExtensionsAPI, "get");
      mockExtensionsAPI.get.mockResolvedValue(mockStoredExtension);

      // When
      const result = await loader.getExtension(extensionId);

      // Then
      expect(getSpy).toHaveBeenCalledWith(extensionId);
      expect(result).toBe(mockExtensionInfo);
    });

    it("When getting a non-existent extension, Then should return undefined", async () => {
      // Given
      const extensionId = BasicBuilder.string();
      const getSpy = jest.spyOn(mockExtensionsAPI, "get");
      getSpy.mockResolvedValue(undefined);

      // When
      const result = await loader.getExtension(extensionId);

      // Then
      expect(getSpy).toHaveBeenCalledWith(extensionId);
      expect(result).toBeUndefined();
    });
  });

  describe("getExtensions", () => {
    it("When listing extensions, Then should return array of extension info", async () => {
      // Given
      const mockExtensions = ExtensionBuilder.extensionsInfo(3);
      const listSpy = jest.spyOn(mockExtensionsAPI, "list");
      listSpy.mockResolvedValue(mockExtensions);

      // When
      const result = await loader.getExtensions();

      // Then
      expect(listSpy).toHaveBeenCalled();
      expect(result).toBe(mockExtensions);
    });
  });

  describe("loadExtension", () => {
    it("When loading a valid extension, Then should return loaded extension with content", async () => {
      // Given
      const extensionId = BasicBuilder.string();
      const extensionContent = BasicBuilder.string();

      // Create mock ZIP file
      const zip = new JSZip();
      zip.file(ALLOWED_FILES.EXTENSION, extensionContent);
      const mockFoxeData = await zip.generateAsync({ type: "uint8array" });

      const loadSpy = jest.spyOn(mockExtensionsAPI, "loadContent");
      loadSpy.mockResolvedValue(mockFoxeData);

      // When
      const result = await loader.loadExtension(extensionId);

      // Then
      expect(loadSpy).toHaveBeenCalledWith(extensionId);
      expect(result.buffer).toBe(mockFoxeData);
      expect(result.raw).toBe(extensionContent);
    });

    it("When loading a non-existent extension, Then should throw error", async () => {
      // Given
      const extensionId = BasicBuilder.string();
      mockExtensionsAPI.loadContent.mockResolvedValue(undefined);

      // When & Then - Should throw error
      await expect(loader.loadExtension(extensionId)).rejects.toThrow(
        "Extension is corrupted or does not exist in the file system.",
      );
    });

    it("When loading extension with missing main file, Then should throw error", async () => {
      // Given
      const extensionId = BasicBuilder.string();
      const zip = new JSZip();
      zip.file(BasicBuilder.string(), BasicBuilder.string());
      const mockFoxeData = await zip.generateAsync({ type: "uint8array" });

      mockExtensionsAPI.loadContent.mockResolvedValue(mockFoxeData);

      // When & Then - Should throw error
      await expect(loader.loadExtension(extensionId)).rejects.toThrow(
        `Extension is corrupted: missing ${ALLOWED_FILES.EXTENSION}`,
      );
    });
  });

  describe("installExtension", () => {
    it("When installing a valid extension, Then should create extension with normalized info", async () => {
      // Given
      const mockPackageJson = {
        name: "test-extension",
        namespace: mockNamespace,
        publisher: "Test Publisher!@#",
        version: BasicBuilder.string(),
        description: BasicBuilder.string(),
        displayName: BasicBuilder.string(),
      };

      const zip = new JSZip();
      zip.file(ALLOWED_FILES.PACKAGE, JSON.stringify(mockPackageJson) ?? "");
      zip.file(ALLOWED_FILES.EXTENSION, BasicBuilder.string());
      zip.file(ALLOWED_FILES.README, BasicBuilder.string());
      zip.file(ALLOWED_FILES.CHANGELOG, BasicBuilder.string());
      const mockFoxeData = await zip.generateAsync({ type: "uint8array" });

      const mockFile = {} as File;
      const mockStoredExtension = ExtensionBuilder.storedExtension();
      const createOrUpdateSpy = jest.spyOn(mockExtensionsAPI, "createOrUpdate");
      createOrUpdateSpy.mockResolvedValue(mockStoredExtension);

      // When
      const result = await loader.installExtension({ foxeFileData: mockFoxeData, file: mockFile });

      // Then
      expect(createOrUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          info: expect.objectContaining({
            id: `Test Publisher.${mockPackageJson.name}`,
            name: mockPackageJson.name,
            namespace: mockNamespace,
            publisher: mockPackageJson.publisher,
            qualifiedName: mockPackageJson.displayName,
          }),
          workspace,
        }),
        mockFile,
      );
      expect(result).toBe(mockStoredExtension.info);
    });

    it("When installing extension without file parameter, Then should throw error", async () => {
      // Given
      const zip = new JSZip();
      zip.file(ALLOWED_FILES.PACKAGE, JSON.stringify({ name: "test" }) ?? "");
      const mockFoxeData = await zip.generateAsync({ type: "uint8array" });

      // When & Then - Should throw error
      await expect(
        loader.installExtension({ foxeFileData: mockFoxeData, file: undefined }),
      ).rejects.toThrow("File is required to install extension in server.");
    });

    it("When installing extension with missing package.json, Then should throw error", async () => {
      // Given
      const zip = new JSZip();
      zip.file(ALLOWED_FILES.EXTENSION, BasicBuilder.string());
      const mockFoxeData = await zip.generateAsync({ type: "uint8array" });
      const mockFile = {} as File;

      // When & Then - Should throw error
      await expect(
        loader.installExtension({ foxeFileData: mockFoxeData, file: mockFile }),
      ).rejects.toThrow(
        `Corrupted extension. File "${ALLOWED_FILES.PACKAGE}" is missing in the extension source.`,
      );
    });

    it("When installing extension without displayName, Then should use name as qualifiedName", async () => {
      // Given
      const name = BasicBuilder.string();
      const publisher = BasicBuilder.string();
      const mockPackageJson = {
        name,
        publisher,
        version: BasicBuilder.string(),
        namespace: mockNamespace,
      };

      const zip = new JSZip();
      zip.file(ALLOWED_FILES.PACKAGE, JSON.stringify(mockPackageJson) ?? "");
      zip.file(ALLOWED_FILES.EXTENSION, BasicBuilder.string());
      const mockFoxeData = await zip.generateAsync({ type: "uint8array" });
      const mockFile = {} as File;

      const mockStoredExtension = ExtensionBuilder.storedExtension();
      const createOrUpdateSpy = jest.spyOn(mockExtensionsAPI, "createOrUpdate");
      createOrUpdateSpy.mockResolvedValue(mockStoredExtension);

      // When
      const result = await loader.installExtension({ foxeFileData: mockFoxeData, file: mockFile });

      // Then - validatePackageInfo lowercases the name
      expect(createOrUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          info: expect.objectContaining({
            qualifiedName: name.toLowerCase(),
          }),
        }),
        mockFile,
      );
      expect(result).toBe(mockStoredExtension.info);
    });
  });

  describe("uninstallExtension", () => {
    it("When uninstalling an extension, Then should remove it from remote", async () => {
      // Given
      const extensionId = BasicBuilder.string();
      const removeSpy = jest.spyOn(mockExtensionsAPI, "remove");
      removeSpy.mockResolvedValue(true);

      // When
      await loader.uninstallExtension(extensionId);

      // Then
      expect(removeSpy).toHaveBeenCalledWith(extensionId);
    });
  });
});
