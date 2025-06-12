// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { existsSync } from "fs";
import { readdir, readFile, mkdir, rm, writeFile } from "fs/promises";
import JSZip from "jszip";
import { join as pathJoin } from "path";
import randomString from "randomstring";

import {
  getExtension,
  getExtensions,
  getPackageDirname,
  getPackageId,
  installExtension,
  parsePackageName,
} from "./extensions";
import { ExtensionPackageJson } from "./types";

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

const genericString = (): string =>
  randomString.generate({ length: 6, charset: "alphanumeric", capitalization: "lowercase" });

function generateExtensionPackageJSon({
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

describe("getPackageId", () => {
  it("should throw an error if package.json is undefined", () => {
    const undefinedPackageJson = undefined;

    const result = () => {
      getPackageId(undefinedPackageJson);
    };

    expect(result).toThrow(`Missing package.json`);
  });

  it("should throw an error if package.json is missing name field", () => {
    const invalidPackageJson: Partial<ExtensionPackageJson> = {
      version: genericString(),
      main: genericString(),
      publisher: genericString(),
    };

    const result = () => {
      getPackageId(invalidPackageJson as ExtensionPackageJson);
    };

    expect(result).toThrow(`package.json is missing required "name" field`);
  });

  it("should throw an error if package.json is missing version field", () => {
    const invalidPackageJson: Partial<ExtensionPackageJson> = {
      name: genericString(),
      main: genericString(),
      publisher: genericString(),
    };

    const result = () => {
      getPackageId(invalidPackageJson as ExtensionPackageJson);
    };

    expect(result).toThrow(`package.json is missing required "version" field`);
  });

  it("should throw an error if package.json is missing publisher field", () => {
    const invalidPackageJson: Partial<ExtensionPackageJson> = generateExtensionPackageJSon();

    const result = () => {
      getPackageId(invalidPackageJson as ExtensionPackageJson);
    };

    expect(result).toThrow(`package.json is missing required "publisher" field`);
  });

  it("should throw an error if package.json contains an invalid publisher", () => {
    const invalidPackageJson: Partial<ExtensionPackageJson> = generateExtensionPackageJSon({
      publisher: "-----",
    });

    const result = () => {
      getPackageId(invalidPackageJson as ExtensionPackageJson);
    };

    expect(result).toThrow(`package.json contains an invalid "publisher" field`);
  });

  it("should return an identifier with package publisher and name", () => {
    const publisher = "lichtblick";
    const mockPakageJson = generateExtensionPackageJSon({ publisher });

    const result = getPackageId(mockPakageJson);

    expect(result).toBe(`lichtblick.${mockPakageJson.name}`);
  });
});

describe("getPackageDirname", () => {
  const mockPakageJson = generateExtensionPackageJSon({ publisher: genericString() });
  it("should return a valid directory name for a valid package.json", () => {
    const result = getPackageDirname(mockPakageJson);

    expect(result).toBe(
      `${mockPakageJson.publisher}.${mockPakageJson.name}-${mockPakageJson.version}`,
    );
  });

  it("should throw an error if the directory name exceeds 255 characters", () => {
    mockPakageJson.name = genericString().repeat(50);
    mockPakageJson.publisher = genericString().repeat(100);

    expect(() => getPackageDirname(mockPakageJson)).toThrow(
      "package.json publisher.name-version is too long",
    );
  });
});

describe("parsePackageName", () => {
  it("should return the namespace and name for a scoped package name", () => {
    const mockName = "@lichtblick-namespace/extension-package";
    const result = parsePackageName(mockName);

    expect(result).toEqual({
      namespace: "lichtblick-namespace",
      name: "extension-package",
    });
  });

  it("should return only the name if the package name is not scoped", () => {
    const mockName = "extension-package";
    const result = parsePackageName(mockName);

    expect(result).toEqual({
      name: "extension-package",
    });
  });

  it("should handle invalid package names gracefully", () => {
    const result = parsePackageName("");

    expect(result).toEqual({
      name: "",
    });
  });
});

describe("getExtension", () => {
  const rootFolder = "/mock/extensions";

  it("should return undefined if the root folder does not exist", async () => {
    // Given
    const extensionId = genericString();
    (existsSync as jest.Mock).mockReturnValue(false);

    // When
    const result = await getExtension(extensionId, rootFolder);

    // Then
    expect(result).toBeUndefined();
    expect(existsSync).toHaveBeenCalledWith(rootFolder);
  });

  it("should return undefined if no matching extension is found", async () => {
    // Given
    const extensionId = genericString();
    const extensionName = genericString();
    (existsSync as jest.Mock).mockReturnValue(true);
    (readdir as jest.Mock).mockResolvedValue([{ name: extensionName, isDirectory: () => true }]);
    (readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path.endsWith("package.json")) {
        const otherPackageJson = generateExtensionPackageJSon({ publisher: genericString() });
        return JSON.stringify(otherPackageJson);
      }
      return "";
    });

    // When
    const result = await getExtension(extensionId, rootFolder);

    // Then
    expect(result).toBeUndefined();
    expect(readdir).toHaveBeenCalledWith(rootFolder, { withFileTypes: true });
  });

  it("should return the extension if a matching id is found", async () => {
    // Given
    const mockReadmeContent = genericString();
    const mockChangelogContent = genericString();
    const publisher = genericString();
    const extensionName = genericString();
    const mockPackageJson = generateExtensionPackageJSon({
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
    const result = await getExtension(extensionId, rootFolder);

    // Then
    expect(result).toMatchObject({
      id: extensionId,
      packageJson: mockPackageJson,
      directory: `${rootFolder}/${extensionName}`,
      readme: mockReadmeContent,
      changelog: mockChangelogContent,
    });
  });

  it("should return the extension with empty readme and changelog if those files are missing", async () => {
    // Given
    const publisher = genericString();
    const extensionName = genericString();
    const mockPackageJson = generateExtensionPackageJSon({
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
    const result = await getExtension(extensionId, rootFolder);

    // Then
    expect(result).toMatchObject({
      id: extensionId,
      packageJson: mockPackageJson,
      directory: `${rootFolder}/${extensionName}`,
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
    const result = await getExtension(extensionId, rootFolder);

    // Then
    expect(result).toBeUndefined();
  });
});

describe("getExtensions", () => {
  const mockRootFolder = "/mock/extensions";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return an empty array if the root folder does not exist", async () => {
    (existsSync as jest.Mock).mockReturnValue(false);

    const result = await getExtensions(mockRootFolder);

    expect(result).toEqual([]);
    expect(existsSync).toHaveBeenCalledWith(mockRootFolder);
  });

  it("should return an empty array if the root folder is empty", async () => {
    (existsSync as jest.Mock).mockReturnValue(true);
    (readdir as jest.Mock).mockResolvedValue([]);

    const result = await getExtensions(mockRootFolder);

    expect(result).toEqual([]);
    expect(readdir).toHaveBeenCalledWith(mockRootFolder, { withFileTypes: true });
  });

  it("should skip all entries when isDirectory is false", async () => {
    (existsSync as jest.Mock).mockReturnValue(true);
    (readdir as jest.Mock).mockResolvedValue([{ isDirectory: () => false }]);

    const result = await getExtensions(mockRootFolder);

    expect(result).toEqual([]);
    expect(readdir).toHaveBeenCalledWith(mockRootFolder, { withFileTypes: true });
  });

  it("should load extensions from valid directories", async () => {
    const mockPackageJson = generateExtensionPackageJSon({ publisher: genericString() });

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

    const result = await getExtensions(mockRootFolder);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: `${mockPackageJson.publisher}.${mockPackageJson.name}`,
      packageJson: mockPackageJson,
      directory: `${mockRootFolder}/extension1`,
      readme: "",
      changelog: "",
    });
    expect(result[1]).toMatchObject({
      id: `${mockPackageJson.publisher}.${mockPackageJson.name}`,
      packageJson: mockPackageJson,
      directory: `${mockRootFolder}/extension2`,
      readme: "",
      changelog: "",
    });
  });

  it("should handle errors gracefully and continue processing other extensions with README and CHANGELOG", async () => {
    const mockPackageJson = generateExtensionPackageJSon({ publisher: genericString() });
    const mockReadmeContent = genericString();
    const mockChangelogContent = genericString();

    (existsSync as jest.Mock).mockReturnValue(true);
    (readdir as jest.Mock).mockResolvedValue([
      { name: "extension1", isDirectory: () => true },
      { name: "extension2", isDirectory: () => true },
    ]);
    (readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path.includes("extension1")) {
        if (path.endsWith("README.md")) {
          return await Promise.resolve(mockReadmeContent);
        }
        if (path.endsWith("CHANGELOG.md")) {
          return await Promise.resolve(mockChangelogContent);
        }
        throw new Error("Failed to read package.json");
      }
      if (path.endsWith("package.json")) {
        return await Promise.resolve(JSON.stringify(mockPackageJson));
      }
      if (path.endsWith("README.md")) {
        return await Promise.resolve(mockReadmeContent);
      }
      if (path.endsWith("CHANGELOG.md")) {
        return await Promise.resolve(mockChangelogContent);
      }
      return await Promise.resolve("");
    });

    const result = await getExtensions(mockRootFolder);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: `${mockPackageJson.publisher}.${mockPackageJson.name}`,
      packageJson: mockPackageJson,
      directory: `${mockRootFolder}/extension2`,
      readme: mockReadmeContent,
      changelog: mockChangelogContent,
    });
    (console.error as jest.Mock).mockClear();
  });
});

describe("installExtension", () => {
  const mockRootFolder = "/mock/extensions";
  const mockPackageJson = generateExtensionPackageJSon({ publisher: genericString() });
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
    const result = await installExtension(new Uint8Array([1, 2, 3]), mockRootFolder);

    expect(result).toMatchObject({
      id: `${mockPackageJson.publisher}.${mockPackageJson.name}`,
      packageJson: mockPackageJson,
      directory: expect.stringContaining(`${mockPackageJson.publisher}.${mockPackageJson.name}`),
      readme: mockReadmeContent,
      changelog: mockChangelogContent,
    });

    const expectedDir = pathJoin(
      mockRootFolder,
      `${mockPackageJson.publisher}.${mockPackageJson.name}-${mockPackageJson.version}`,
    );
    expect(rm).toHaveBeenCalledWith(expectedDir, { recursive: true, force: true });
    expect(mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      pathJoin(expectedDir, "file.txt"),
      expect.any(Uint8Array),
    );
  });

  it("should throw an error if package.json is missing", async () => {
    delete mockArchive.files["package.json"];

    await expect(installExtension(new Uint8Array([1, 2, 3]), mockRootFolder)).rejects.toThrow(
      "Extension does not contain a package.json file",
    );
  });

  it("should throw an error if package.json is invalid", async () => {
    mockArchive.files["package.json"].async.mockResolvedValue("invalid-json");

    await expect(installExtension(new Uint8Array([1, 2, 3]), mockRootFolder)).rejects.toThrow(
      "Extension contains an invalid package.json",
    );

    (console.error as jest.Mock).mockClear();
  });
});
