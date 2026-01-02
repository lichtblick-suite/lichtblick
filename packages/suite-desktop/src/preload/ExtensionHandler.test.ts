// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { existsSync } from "fs";
import { readdir, readFile, mkdir, rm, writeFile } from "fs/promises";
import JSZip from "jszip";
import { join } from "path";
import randomString from "randomstring";

import { ExtensionsHandler } from "./ExtensionHandler";
import type { ExtensionPackageJson } from "./types";
import { DesktopExtension } from "../common/types";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  rm: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock("jszip", () => ({
  loadAsync: jest.fn(),
}));

const genericString = (options: Randomstring.GenerateOptions = {}): string =>
  randomString.generate({
    length: 6,
    charset: "alphanumeric",
    capitalization: "lowercase",
    ...options,
  });

function generateExtensionPackageJson({
  name,
  version,
  main,
  publisher,
}: Partial<ExtensionPackageJson> = {}): ExtensionPackageJson {
  return {
    name: name ?? genericString(),
    version: version ?? genericString(),
    main: main ?? genericString(),
    publisher,
  };
}

function generateDesktopExtension(extension: Partial<DesktopExtension> = {}): DesktopExtension {
  return {
    id: genericString(),
    packageJson: generateExtensionPackageJson(),
    directory: genericString(),
    readme: genericString(),
    changelog: genericString(),
    ...extension,
  };
}

describe("ExtensionsHandler", () => {
  const rootDir = "/mock/extensions";
  const extensionsHandler = new ExtensionsHandler(rootDir);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPackageId", () => {
    const getPackageId = (pkgJson: ExtensionPackageJson | undefined) => () =>
      // @ts-expect-error: testing private method
      ExtensionsHandler.getPackageId(pkgJson);

    it("should throw when package.json is undefined", () => {
      // Given
      const pkgJson = undefined;

      // When
      const call = getPackageId(pkgJson);

      // Then
      expect(call).toThrow("Missing package.json");
    });

    it("should throw when package.json is missing name", () => {
      // Given
      const pkgJson = {
        version: "1.0.0",
        publisher: "lichtblick",
      } as ExtensionPackageJson;

      // When
      const call = getPackageId(pkgJson);

      // Then
      expect(call).toThrow('package.json is missing required "name" field');
    });

    it("should throw when name is an empty string", () => {
      // Given
      const pkgJson = {
        name: " ",
        version: "1.0.0",
        publisher: "lichtblick",
      } as ExtensionPackageJson;

      // When
      const call = getPackageId(pkgJson);

      // Then
      expect(call).toThrow('package.json "name" field cannot be empty');
    });

    it("should throw when package.json is missing version", () => {
      // Given
      const pkgJson = {
        name: genericString(),
        publisher: genericString(),
      } as ExtensionPackageJson;

      // When
      const call = getPackageId(pkgJson);

      // Then
      expect(call).toThrow('package.json is missing required "version" field');
    });

    it("should throw when version is an empty string", () => {
      // Given
      const pkgJson = {
        name: genericString(),
        version: " ",
        publisher: "lichtblick",
      } as ExtensionPackageJson;

      // When
      const call = getPackageId(pkgJson);

      // Then
      expect(call).toThrow('package.json "version" field cannot be empty');
    });

    it("should throw when package.json is missing publisher and namespace", () => {
      // Given
      const pkgJson = {
        name: genericString(),
        version: "1.0.0",
      } as ExtensionPackageJson;

      // When
      const call = getPackageId(pkgJson);

      // Then
      expect(call).toThrow('package.json is missing required "publisher" field');
    });

    it("should throw when publisher is only non-word characters", () => {
      // Given
      const pkgJson = {
        name: genericString(),
        version: "1.0.0",
        publisher: "@!#", // Non-word characters only
      } as ExtensionPackageJson;

      // When
      const call = getPackageId(pkgJson);

      // Then
      expect(call).toThrow('package.json contains an invalid "publisher" field');
    });

    it("should use publisher from package.json if present", () => {
      // Given
      const pkgJson: ExtensionPackageJson = {
        name: genericString(),
        version: "1.0.0",
        main: "main.js",
        publisher: genericString({ capitalization: "uppercase" }),
      };

      // When
      // @ts-expect-error: testing private method
      const id = ExtensionsHandler.getPackageId(pkgJson);

      // Then
      expect(id).toBe(`${pkgJson.publisher?.toLowerCase()}.${pkgJson.name}`);
    });

    it("should use namespace as publisher if publisher is missing", () => {
      // Given
      const name = `@${genericString({ capitalization: "uppercase" })}/${genericString()}`;
      const pkgJson: ExtensionPackageJson = {
        name,
        version: "1.0.0",
        main: "main.js",
      };

      // When
      // @ts-expect-error: testing private method
      const id = ExtensionsHandler.getPackageId(pkgJson);

      // Then
      expect(id).toBe(pkgJson.name.toLowerCase().replace("/", ".").replace("@", ""));
    });

    it("should strip non-word characters from publisher", () => {
      // Given
      const pkgJson: ExtensionPackageJson = {
        name: genericString(),
        version: "1.0.0",
        main: "main.js",
        publisher: genericString({ capitalization: "uppercase" }),
      };

      // When
      // @ts-expect-error: testing private method
      const id = ExtensionsHandler.getPackageId(pkgJson);

      // Then
      expect(id).toBe(`${pkgJson.publisher?.toLowerCase()}.${pkgJson.name}`);
    });
  });

  describe("getPackageDirname", () => {
    const getPackageDirname = (pkgJson: ExtensionPackageJson) => () =>
      // @ts-expect-error: testing private method
      ExtensionsHandler.getPackageDirname(pkgJson);

    it("should throw when package.json is missing name", () => {
      // Given
      const pkgJson = {
        version: "1.0.0",
        publisher: "lichtblick",
      } as ExtensionPackageJson;

      // When
      const call = getPackageDirname(pkgJson);

      // Then
      expect(call).toThrow('package.json is missing required "name" field');
    });

    it("should throw when package.json is missing version", () => {
      // Given
      const pkgJson = {
        name: genericString(),
        publisher: genericString(),
      } as ExtensionPackageJson;

      // When
      const call = getPackageDirname(pkgJson);

      // Then
      expect(call).toThrow('package.json is missing required "version" field');
    });

    it("should return a valid directory name", () => {
      // Given
      const pkgJson: ExtensionPackageJson = {
        name: genericString(),
        version: "1.0.0",
        main: "main.js",
        publisher: genericString(),
      };

      // When
      const dirname = getPackageDirname(pkgJson)();

      // Then
      expect(dirname).toBe(
        `${pkgJson.publisher?.toLowerCase()}.${pkgJson.name}-${pkgJson.version}`,
      );
    });

    it("should throw if the directory name is too long", () => {
      // Given
      const pkgJson: ExtensionPackageJson = {
        name: genericString({ length: 256 }),
        version: "1.0.0",
        main: "main.js",
        publisher: genericString(),
      };

      // When
      const call = getPackageDirname(pkgJson);

      // Then
      expect(call).toThrow("package.json publisher.name-version is too long");
    });
  });

  describe("parsePackageName", () => {
    const parsePackageName = (name: string) => () =>
      // @ts-expect-error: testing private method
      ExtensionsHandler.parsePackageName(name);

    it("should return name and namespace when name is namespaced", () => {
      // Given
      const name = `@${genericString()}/${genericString()}`;

      // When
      const res = parsePackageName(name)();

      // Then
      expect(res).toEqual({
        namespace: name.split("/")[0]?.slice(1),
        name: name.split("/")[1],
      });
    });

    it("should return only name when not namespaced", () => {
      // Given
      const name = genericString();

      // When
      const res = parsePackageName(name)();

      // Then
      expect(res).toEqual({ name });
    });
  });

  describe("get", () => {
    it("should return undefined if the root folder does not exist", async () => {
      // Given
      const extensionId = genericString();
      (existsSync as jest.Mock).mockReturnValue(false);

      // When
      const result = await extensionsHandler.get(extensionId);

      // Then
      expect(result).toBeUndefined();
      expect(existsSync).toHaveBeenCalledWith(rootDir);
    });

    it("should return the extension if a matching id is found", async () => {
      // Given
      const mockReadmeContent = genericString();
      const mockChangelogContent = genericString();
      const publisher = genericString();
      const extensionName = genericString();
      const mockPackageJson = generateExtensionPackageJson({
        name: extensionName,
        publisher,
      });
      const extensionId = `${publisher}.${extensionName}`;

      (existsSync as jest.Mock).mockReturnValue(true);
      (readdir as jest.Mock).mockResolvedValue([{ name: extensionName, isDirectory: () => true }]);
      (readFile as jest.Mock).mockImplementation(async (path: string) => {
        if (path.endsWith("package.json")) {
          return JSON.stringify(mockPackageJson);
        }
        if (path.endsWith("README.md")) {
          return mockReadmeContent;
        }
        if (path.endsWith("CHANGELOG.md")) {
          return mockChangelogContent;
        }
        return "";
      });

      // When
      const result = await extensionsHandler.get(extensionId);

      // Then
      expect(result).toMatchObject({
        id: extensionId,
        packageJson: mockPackageJson,
        directory: `${rootDir}/${extensionName}`,
        readme: mockReadmeContent,
        changelog: mockChangelogContent,
      });
    });

    it("should return the extension with empty readme and changelog if those files are missing", async () => {
      // Given
      const publisher = genericString();
      const extensionName = genericString();
      const mockPackageJson = generateExtensionPackageJson({
        name: extensionName,
        publisher,
      });
      const extensionId = `${publisher}.${extensionName}`;

      (existsSync as jest.Mock).mockReturnValue(true);
      (readdir as jest.Mock).mockResolvedValue([{ name: extensionName, isDirectory: () => true }]);
      (readFile as jest.Mock).mockImplementation(async (path: string) => {
        if (path.endsWith("package.json")) {
          return JSON.stringify(mockPackageJson);
        }
        throw new Error("File not found");
      });

      // When
      const result = await extensionsHandler.get(extensionId);

      // Then
      expect(result).toMatchObject({
        id: extensionId,
        packageJson: mockPackageJson,
        directory: `${rootDir}/${extensionName}`,
        readme: "",
        changelog: "",
      });
    });

    it("should skip directories that are not directories", async () => {
      // Given
      const publisher = genericString();
      const extensionName = genericString();
      const extensionId = `${publisher}.${extensionName}`;

      (existsSync as jest.Mock).mockReturnValue(true);
      (readdir as jest.Mock).mockResolvedValue([{ name: "notadir", isDirectory: () => false }]);

      // When
      const result = await extensionsHandler.get(extensionId);

      // Then
      expect(result).toBeUndefined();
    });
  });

  describe("list", () => {
    it("should return an empty array if the root folder does not exist", async () => {
      (existsSync as jest.Mock).mockReturnValue(false);

      const result = await extensionsHandler.list();

      expect(result).toEqual([]);
      expect(existsSync).toHaveBeenCalledWith(rootDir);
    });

    it("should return an empty array if the root folder is empty", async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readdir as jest.Mock).mockResolvedValue([]);

      const result = await extensionsHandler.list();

      expect(result).toEqual([]);
      expect(readdir).toHaveBeenCalledWith(rootDir, { withFileTypes: true });
    });

    it("should skip all entries when isDirectory is false", async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readdir as jest.Mock).mockResolvedValue([{ isDirectory: () => false }]);

      const result = await extensionsHandler.list();

      expect(result).toEqual([]);
      expect(readdir).toHaveBeenCalledWith(rootDir, { withFileTypes: true });
    });

    it("should get extensions from valid directories", async () => {
      const mockPackageJson = generateExtensionPackageJson({
        publisher: genericString(),
      });

      (existsSync as jest.Mock).mockReturnValue(true);
      (readdir as jest.Mock).mockResolvedValue([
        { name: "extension1", isDirectory: () => true },
        { name: "extension2", isDirectory: () => true },
      ]);
      (readFile as jest.Mock).mockImplementation(async (path: string) => {
        if (path.endsWith("package.json")) {
          return await Promise.resolve(JSON.stringify(mockPackageJson));
        }
        return await Promise.resolve("");
      });

      const result = await extensionsHandler.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: `${mockPackageJson.publisher}.${mockPackageJson.name}`,
        packageJson: mockPackageJson,
        directory: `${rootDir}/extension1`,
        readme: "",
        changelog: "",
      });
      expect(result[1]).toMatchObject({
        id: `${mockPackageJson.publisher}.${mockPackageJson.name}`,
        packageJson: mockPackageJson,
        directory: `${rootDir}/extension2`,
        readme: "",
        changelog: "",
      });
    });

    it("should handle errors gracefully and continue processing valid extensions with README and CHANGELOG", async () => {
      const mockPackageJson = generateExtensionPackageJson({ publisher: genericString() });
      const mockReadmeContent = genericString();
      const mockChangelogContent = genericString();

      (existsSync as jest.Mock).mockReturnValue(true);
      (readdir as jest.Mock).mockResolvedValue([
        { name: "extension1", isDirectory: () => true },
        { name: "extension2", isDirectory: () => true },
      ]);
      (readFile as jest.Mock).mockImplementation(async (path: string) => {
        if (path.includes("extension1")) {
          // Simulate error for extension1's package.json
          if (path.endsWith("package.json")) {
            throw new Error("Failed to read package.json");
          }
          return "";
        }
        // extension2: all files succeed
        if (path.endsWith("package.json")) {
          return JSON.stringify(mockPackageJson);
        }
        if (path.endsWith("README.md")) {
          return mockReadmeContent;
        }
        if (path.endsWith("CHANGELOG.md")) {
          return mockChangelogContent;
        }
        return "";
      });

      const result = await extensionsHandler.list();

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: `${mockPackageJson.publisher}.${mockPackageJson.name}`,
        packageJson: mockPackageJson,
        directory: `${rootDir}/extension2`,
        readme: mockReadmeContent,
        changelog: mockChangelogContent,
      });

      expect(consoleErrorSpy.mock.calls[0]![0]).toBe("[extension]");
      expect(consoleErrorSpy.mock.calls[0]![1]?.message).toBe("Failed to read package.json");

      consoleErrorSpy.mockRestore();
    });
  });

  describe("install", () => {
    const mockPackageJson = generateExtensionPackageJson({ publisher: genericString() });
    const mockReadmeContent = genericString();
    const mockChangelogContent = genericString();
    let mockArchive: any;

    beforeEach(() => {
      jest.clearAllMocks();

      mockArchive = {
        files: {
          "package.json": {
            async: jest.fn().mockResolvedValue(JSON.stringify(mockPackageJson)),
          },
          "README.md": {
            async: jest.fn().mockResolvedValue(mockReadmeContent),
          },
          "CHANGELOG.md": {
            async: jest.fn().mockResolvedValue(mockChangelogContent),
          },
          "file.txt": {
            async: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
          },
        },
      };

      (JSZip.loadAsync as jest.Mock).mockResolvedValue(mockArchive);
    });

    it("should install an extension successfully", async () => {
      // Given
      const foxeFileData = new Uint8Array([1, 2, 3]);

      // When
      const result = await extensionsHandler.install(foxeFileData);

      // Then
      expect(result).toMatchObject({
        id: `${mockPackageJson.publisher}.${mockPackageJson.name}`,
        packageJson: mockPackageJson,
        directory: expect.stringContaining(`${mockPackageJson.publisher}.${mockPackageJson.name}`),
        readme: mockReadmeContent,
        changelog: mockChangelogContent,
      });

      const expectedDir = join(
        rootDir,
        `${mockPackageJson.publisher}.${mockPackageJson.name}-${mockPackageJson.version}`,
      );
      expect(rm).toHaveBeenCalledWith(expectedDir, { recursive: true, force: true });
      expect(mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(join(expectedDir, "file.txt"), expect.any(Uint8Array));
    });

    it("should throw an error if package.json is missing", async () => {
      // Given
      const foxeFileData = new Uint8Array([1, 2, 3]);
      delete mockArchive.files["package.json"];

      // When Then
      await expect(extensionsHandler.install(foxeFileData)).rejects.toThrow(
        "Extension does not contain a package.json file",
      );
    });

    it("should throw an error if package.json is invalid", async () => {
      // Given
      const foxeFileData = new Uint8Array([1, 2, 3]);
      mockArchive.files["package.json"].async.mockResolvedValue("invalid-json");

      // When Then
      await expect(extensionsHandler.install(foxeFileData)).rejects.toThrow(
        "Extension contains an invalid package.json",
      );
      (console.error as jest.Mock).mockClear();
    });
  });

  describe("uninstall", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should uninstall an extension by removing its directory", async () => {
      // Given
      const extensionId = genericString();
      const desktopExtension = generateDesktopExtension();

      jest.spyOn(extensionsHandler, "get").mockResolvedValue(desktopExtension);
      (rm as jest.Mock).mockResolvedValue(undefined);

      // When
      const result = await extensionsHandler.uninstall(extensionId);

      // Then
      expect(rm).toHaveBeenCalledWith(desktopExtension.directory, {
        recursive: true,
        force: true,
      });
      expect(result).toBe(true);
    });

    it("should return false if the extension directory does not exist", async () => {
      // Given
      const extensionId = genericString();

      jest.spyOn(extensionsHandler, "get").mockResolvedValue(undefined);

      // When
      const result = await extensionsHandler.uninstall(extensionId);

      // Then
      expect(result).toBe(false);
      expect(rm).not.toHaveBeenCalled();
    });
  });

  describe("load", () => {
    const getByIdSpy = jest.spyOn(extensionsHandler, "get");

    it("should throw an error when extension is not found", async () => {
      // Given
      const extensionId = genericString();
      jest.spyOn(extensionsHandler, "get").mockResolvedValue(undefined);

      // When Then
      await expect(extensionsHandler.load(extensionId)).rejects.toThrow(
        `Extension ${extensionId} not found in ${rootDir}`,
      );
    });

    it("should return the list of installed extensionsXXXX", async () => {
      // Given
      const extensionId = genericString();
      const desktopExtension = generateDesktopExtension();

      getByIdSpy.mockResolvedValue(desktopExtension);
      (readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(desktopExtension.packageJson));

      // When
      await extensionsHandler.load(extensionId);

      // Then
      const sourcePath = join(
        desktopExtension.directory,
        (desktopExtension.packageJson as ExtensionPackageJson).main,
      );
      expect(getByIdSpy).toHaveBeenCalledWith(extensionId);
      expect(readFile).toHaveBeenCalledWith(sourcePath, { encoding: "utf-8" });
    });
  });
});
