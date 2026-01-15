// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import randomString from "randomstring";

import { ExtensionInfo } from "@lichtblick/suite-base";

import { DesktopExtensionLoader } from "./DesktopExtensionLoader";
import { Desktop, DesktopExtension, LoadedExtension } from "../../common/types";

jest.mock("@lichtblick/log", () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
  })),
}));

const genericString = (): string =>
  randomString.generate({ length: 6, charset: "alphanumeric", capitalization: "lowercase" });

describe("DesktopExtensionLoader", () => {
  let mockBridge: jest.Mocked<Desktop>;
  let loader: DesktopExtensionLoader;

  beforeEach(() => {
    mockBridge = {
      getExtensions: jest.fn(),
      loadExtension: jest.fn(),
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    } as unknown as jest.Mocked<Desktop>;

    loader = new DesktopExtensionLoader(mockBridge);
  });

  describe("getExtension", () => {
    it("should return an extension if it exists", async () => {
      const desktopExtensionLoader = new DesktopExtensionLoader(mockBridge);
      const displayName = genericString();
      const extension: DesktopExtension = {
        id: genericString(),
        packageJson: { displayName },
        readme: genericString(),
        changelog: genericString(),
        directory: genericString(),
      };

      mockBridge.getExtensions.mockResolvedValueOnce([extension]);

      const result = await loader.getExtension(extension.id);
      expect(mockBridge.getExtensions).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: extension.id,
        name: displayName,
        namespace: desktopExtensionLoader.namespace,
        qualifiedName: displayName,
        displayName,
        readme: extension.readme,
        changelog: extension.changelog,
      });
    });

    it("should return undefined if the extension does not exist", async () => {
      const nonExistentId = genericString();
      mockBridge.getExtensions.mockResolvedValueOnce([]);

      const result = await loader.getExtension(nonExistentId);

      expect(mockBridge.getExtensions).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });
  });

  describe("getExtensions", () => {
    it("should return a list of extensions", async () => {
      const desktopExtensionLoader = new DesktopExtensionLoader(mockBridge);
      const extensions: DesktopExtension[] = [
        {
          id: genericString(),
          packageJson: { displayName: genericString() } as ExtensionInfo,
          readme: genericString(),
          changelog: genericString(),
        } as DesktopExtension,
        {
          id: genericString(),
          packageJson: { displayName: genericString() } as ExtensionInfo,
          readme: genericString(),
          changelog: genericString(),
        } as DesktopExtension,
      ];
      mockBridge.getExtensions.mockResolvedValue(extensions);

      const result = await loader.getExtensions();

      expect(mockBridge.getExtensions).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          ...(extensions[0]?.packageJson as ExtensionInfo),
          id: extensions[0]?.id,
          name: (extensions[0]?.packageJson as ExtensionInfo).displayName,
          namespace: desktopExtensionLoader.namespace,
          qualifiedName: (extensions[0]?.packageJson as ExtensionInfo).displayName,
          readme: extensions[0]?.readme,
          changelog: extensions[0]?.changelog,
        },
        {
          ...(extensions[1]?.packageJson as ExtensionInfo),
          id: extensions[1]?.id,
          name: (extensions[1]?.packageJson as ExtensionInfo).displayName,
          namespace: desktopExtensionLoader.namespace,
          qualifiedName: (extensions[1]?.packageJson as ExtensionInfo).displayName,
          readme: extensions[1]?.readme,
          changelog: extensions[1]?.changelog,
        },
      ]);
    });

    it("should return an empty array if no extensions are available", async () => {
      mockBridge.getExtensions.mockResolvedValue([]);

      const result = await loader.getExtensions();

      expect(mockBridge.getExtensions).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });
  });

  describe("loadExtension", () => {
    it("should return the extension content if loaded successfully", async () => {
      const loadedContent: LoadedExtension = { raw: "console.log('loaded');" };
      const extensionId = genericString();
      mockBridge.loadExtension.mockResolvedValue(loadedContent);

      const result = await loader.loadExtension(extensionId);

      expect(mockBridge.loadExtension).toHaveBeenCalledWith(extensionId);
      expect(result).toEqual(loadedContent);
    });

    it("should throw an error if the bridge is not available", async () => {
      const nonExistentId = genericString();
      loader = new DesktopExtensionLoader(undefined as unknown as Desktop);

      await expect(loader.loadExtension(nonExistentId)).rejects.toThrow(
        "Cannot load extension without a desktopBridge",
      );
    });
  });

  describe("installExtension", () => {
    it("should install an extension successfully", async () => {
      const desktopExtensionLoader = new DesktopExtensionLoader(mockBridge);
      const displayName = genericString();
      const foxeFileData = new Uint8Array([1, 2, 3]);
      const extension: DesktopExtension = {
        id: genericString(),
        packageJson: { displayName } as ExtensionInfo,
        readme: genericString(),
        changelog: genericString(),
      } as DesktopExtension;

      mockBridge.installExtension.mockResolvedValue(extension);

      const result = await loader.installExtension({ foxeFileData });

      expect(mockBridge.installExtension).toHaveBeenCalledWith(foxeFileData);
      expect(result).toEqual({
        ...(extension.packageJson as ExtensionInfo),
        id: extension.id,
        name: displayName,
        namespace: desktopExtensionLoader.namespace,
        qualifiedName: displayName,
        readme: extension.readme,
        changelog: extension.changelog,
      });
    });

    it("should throw an error if bridge is undefined", async () => {
      loader = new DesktopExtensionLoader(undefined as unknown as Desktop);

      await expect(
        loader.installExtension({ foxeFileData: new Uint8Array([1, 2, 3]) }),
      ).rejects.toThrow("Cannot install extension without a desktopBridge");
    });
  });

  describe("uninstallExtension", () => {
    it("should successfully uninstall an extension", async () => {
      const extensionId = genericString();
      await loader.uninstallExtension(extensionId);

      expect(mockBridge.uninstallExtension).toHaveBeenCalledWith(extensionId);
    });
  });
});
