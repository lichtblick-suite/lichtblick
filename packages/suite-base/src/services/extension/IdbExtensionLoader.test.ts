// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import fs from "fs";
import { openDB } from "idb/with-async-ittr";
import JSZip from "jszip";

import { StoredExtension } from "@lichtblick/suite-base/services/IExtensionStorage";
import {
  EXTENSION_STORE_NAME,
  METADATA_STORE_NAME,
} from "@lichtblick/suite-base/services/extension/IdbExtensionStorage";
import { ALLOWED_FILES } from "@lichtblick/suite-base/services/extension/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

import { IdbExtensionLoader } from "./IdbExtensionLoader";

jest.mock("idb/with-async-ittr", () => ({
  openDB: jest.fn(),
}));

const packageJson: Record<string, unknown> = {
  description: "",
  devDependencies: {
    "@foxglove/fox": "file:../fox",
    "@foxglove/studio": "0.11.0",
    typescript: "4.3.2",
  },
  displayName: "turtlesim",
  id: "Foxglove Inc.studio-extension-turtlesim",
  license: "MPL-2.0",
  main: "./dist/extension.js",
  name: "studio-extension-turtlesim",
  publisher: "Foxglove Inc.",
  scripts: {
    build: "fox build",
    "foxglove:prepublish": "fox build --mode production",
    "local-install": "fox build && fox install",
    package: "fox build --mode production && fox package",
    pretest: "fox pretest",
  },
  version: "0.0.1",
};

const expectedReadme = "# studio-extension-turtlesim\n\n## _A Foxglove Studio Extension_\n";
const expectedChangelog =
  "# studio-extension-turtlesim version history\n\n## 0.0.0\n\n- Alpha testing\n";

const expectedExtensionInfo: ExtensionInfo = {
  ...packageJson,
  namespace: "local",
  qualifiedName: "turtlesim",
  readme: expectedReadme,
  changelog: expectedChangelog,
} as ExtensionInfo;

const EXT_FILE_TURTLESIM = `${__dirname}/../../test/fixtures/lichtblick.suite-extension-turtlesim-0.0.1.foxe`;

jest.mock("@lichtblick/log", () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
  })),
}));

describe("IdbExtensionLoader", () => {
  const mockGet = jest.fn();
  const mockGetAll = jest.fn();
  const mockPut = jest.fn();
  const mockDelete = jest.fn();

  beforeEach(() => {
    (openDB as jest.Mock).mockReturnValue({
      transaction: jest.fn().mockReturnValue({ db: { put: mockPut, delete: mockDelete } }),
      getAll: mockGetAll,
      get: mockGet,
      delete: mockDelete,
    });
  });

  describe("installExtension", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should install local extensions", async () => {
      const foxe = fs.readFileSync(EXT_FILE_TURTLESIM);
      const loader = new IdbExtensionLoader("local");

      await loader.installExtension({ foxeFileData: foxe as unknown as Uint8Array });

      expect(mockPut).toHaveBeenCalledWith(METADATA_STORE_NAME, expectedExtensionInfo);
      expect(mockPut).toHaveBeenCalledWith(EXTENSION_STORE_NAME, {
        content: foxe,
        info: expectedExtensionInfo,
      });
    });

    it("should install private extensions", async () => {
      const foxe = fs.readFileSync(EXT_FILE_TURTLESIM);
      const info: ExtensionInfo = {
        ...expectedExtensionInfo,
        namespace: "org",
        qualifiedName: expectedExtensionInfo.displayName,
      };
      mockGetAll.mockReturnValue([info]);
      const loader = new IdbExtensionLoader("org");

      await loader.installExtension({ foxeFileData: foxe as unknown as Uint8Array });

      expect(mockPut).toHaveBeenCalledWith(METADATA_STORE_NAME, info);
      expect(mockPut).toHaveBeenCalledWith(EXTENSION_STORE_NAME, {
        content: foxe,
        info,
      });
      expect((await loader.getExtensions())[0]).toBe(info);
    });

    it("When installing extension with missing package.json, Then should throw error", async () => {
      // Given
      const zip = new JSZip();
      zip.file(ALLOWED_FILES.EXTENSION, BasicBuilder.string());
      const mockFoxeData = await zip.generateAsync({ type: "uint8array" });
      const loader = new IdbExtensionLoader("local");

      // When & Then - Should throw error
      await expect(loader.installExtension({ foxeFileData: mockFoxeData })).rejects.toThrow(
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
      };

      const zip = new JSZip();
      zip.file(ALLOWED_FILES.PACKAGE, JSON.stringify(mockPackageJson) ?? "");
      zip.file(ALLOWED_FILES.EXTENSION, BasicBuilder.string());
      const mockFoxeData = await zip.generateAsync({ type: "uint8array" });
      const loader = new IdbExtensionLoader("local");

      // When
      const result = await loader.installExtension({ foxeFileData: mockFoxeData });

      // Then - validatePackageInfo lowercases the name
      expect(result.qualifiedName).toBe(name.toLowerCase());
    });

    it("When installing extension without README and CHANGELOG files, Then should default both to empty strings", async () => {
      // Given
      const name = BasicBuilder.string();
      const publisher = BasicBuilder.string();
      const mockPackageJson = {
        name,
        publisher,
        version: BasicBuilder.string(),
      };

      const zip = new JSZip();
      zip.file(ALLOWED_FILES.PACKAGE, JSON.stringify(mockPackageJson) ?? "");
      zip.file(ALLOWED_FILES.EXTENSION, BasicBuilder.string());
      // No README or CHANGELOG files added
      const mockFoxeData = await zip.generateAsync({ type: "uint8array" });
      const loader = new IdbExtensionLoader("local");

      // When
      const result = await loader.installExtension({ foxeFileData: mockFoxeData });

      // Then
      expect(result.readme).toBe("");
      expect(result.changelog).toBe("");
    });
  });

  describe("loadExtension", () => {
    it("should successfully load an extension with valid files", async () => {
      const loader = new IdbExtensionLoader("local");
      const rawContent = "console.log('valid extension');";
      const jsZip = new JSZip();
      jsZip.file(ALLOWED_FILES.EXTENSION, rawContent);
      jest.spyOn(JSZip.prototype, "loadAsync").mockResolvedValue(jsZip);
      const extension: StoredExtension = {
        info: {
          id: BasicBuilder.string(),
        } as ExtensionInfo,
        content: await jsZip.generateAsync({ type: "uint8array" }),
      };
      mockGet.mockReturnValueOnce(extension);

      const result = await loader.loadExtension(extension.info.id);

      expect(mockGet).toHaveBeenCalledWith(EXTENSION_STORE_NAME, extension.info.id);
      expect(result.raw).toContain(rawContent);
    });

    it("should throw an error if the extension is not found", async () => {
      const loader = new IdbExtensionLoader("local");
      mockGet.mockResolvedValue(undefined);

      await expect(loader.loadExtension(BasicBuilder.string())).rejects.toThrow(
        "Extension not found",
      );
    });

    it("should throw an error if extension content is missing", async () => {
      const loader = new IdbExtensionLoader("local");
      const extension: StoredExtension = {
        info: {
          id: BasicBuilder.string(),
        } as ExtensionInfo,
        content: undefined as any,
      };
      mockGet.mockResolvedValue(undefined);

      await expect(loader.loadExtension(extension.info.id)).rejects.toThrow("Extension not found");
    });

    it("should throw an error if the main extension script is missing", async () => {
      const loader = new IdbExtensionLoader("local");
      const rawContent = "console.log('valid extension');";
      const jsZip = new JSZip();
      jsZip.file(BasicBuilder.string(), rawContent);
      jest.spyOn(JSZip.prototype, "loadAsync").mockResolvedValue(jsZip);
      const extension: StoredExtension = {
        info: {
          id: BasicBuilder.string(),
        } as ExtensionInfo,
        content: await jsZip.generateAsync({ type: "uint8array" }),
      };
      mockGet.mockReturnValueOnce(extension);

      await expect(loader.loadExtension(extension.info.id)).rejects.toThrow(
        `Extension is corrupted: missing ${ALLOWED_FILES.EXTENSION}`,
      );
    });
  });

  describe("getExtension", () => {
    it("should return the proper extension when call get extension", async () => {
      const foxe = fs.readFileSync(EXT_FILE_TURTLESIM);
      const expectedInfo: ExtensionInfo = {
        ...packageJson,
        namespace: "local",
        qualifiedName: "turtlesim",
      } as ExtensionInfo;
      mockGet.mockReturnValue({
        info: expectedInfo,
      } as StoredExtension);
      const loader = new IdbExtensionLoader("local");

      await loader.installExtension({ foxeFileData: foxe as unknown as Uint8Array });
      const result = await loader.getExtension(expectedInfo.id);

      expect(mockGet).toHaveBeenCalledWith(EXTENSION_STORE_NAME, expectedInfo.id);
      expect(result).toBe(expectedInfo);
    });
  });

  describe("uninstallExtension", () => {
    it("should successfully uninstall an extension", async () => {
      const extensionId = BasicBuilder.string();
      const loader = new IdbExtensionLoader("local");

      await loader.uninstallExtension(extensionId);

      expect(mockDelete).toHaveBeenCalledTimes(2);
      expect(mockDelete).toHaveBeenNthCalledWith(1, METADATA_STORE_NAME, extensionId);
      expect(mockDelete).toHaveBeenNthCalledWith(2, EXTENSION_STORE_NAME, extensionId);
    });
  });
});
