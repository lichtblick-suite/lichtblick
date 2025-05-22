// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs, { Dirent, Stats } from "fs";
import mockFs from "mock-fs";
import { DirectoryItems } from "mock-fs/lib/filesystem";
import os from "os";
import randomString from "randomstring";

import { getFilesFromDirectory, isPathToDirectory, resolveSourcePaths } from "./resolveSourcePaths";

type FileStructure = {
  name: string;
  content: string;
  extension: string;
};

function genericString(): string {
  return randomString.generate({ length: 6, charset: "alphanumeric" });
}

function buildFile(file: Partial<FileStructure> = {}): Pick<FileStructure, "name" | "content"> {
  return {
    name: `${genericString()}.${file.extension ?? "mcap"}`,
    content: genericString(),
    ...file,
  };
}

function buildPath(): string {
  return `${genericString()}/${genericString()}`;
}

function setup(fsConfigOverride?: DirectoryItems) {
  const path = buildPath();
  const file1 = buildFile({ extension: "txt" });
  const file2 = buildFile({ extension: "txt" });
  const file3 = buildFile({ extension: "mcap" });
  const files = { file1, file2, file3 };
  const fsConfig: DirectoryItems = fsConfigOverride ?? {
    [path]: {
      [file1.name]: file1.content,
      [file2.name]: file2.content,
      [file3.name]: file3.content,
    },
  };

  mockFs(fsConfig);

  return { fsConfig, path, files };
}

afterEach(() => {
  mockFs.restore();
});

describe("getFilesFromDirectory", () => {
  it("should return only the .mcap files from the directory", () => {
    const { path, files } = setup();
    const mcapFiles = Object.values(files)
      .filter((file) => file.name.endsWith(".mcap"))
      .map((file) => file.name);

    const result = getFilesFromDirectory(path);

    expect(result).toEqual(mcapFiles);
  });

  it("should a return a empty array because the directory has no supported files", () => {
    const { path } = setup({
      [genericString()]: buildFile({ extension: "txt" }),
    });

    const result = getFilesFromDirectory(path);

    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("ENOENT, no such file or directory"),
      }),
    );
    (console.error as jest.Mock).mockClear();
  });

  it("should return an empty array when an error occurs in fs.readdirSync", () => {
    const result = getFilesFromDirectory("");

    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "ENOENT: no such file or directory, scandir ''",
      }),
    );
    (console.error as jest.Mock).mockClear();
  });
});

describe("isPathToDirectory", () => {
  it("should return false cause there's more than one path", () => {
    const path1 = buildPath();
    const path2 = buildPath();
    setup({
      [path1]: {},
      [path2]: {},
    });

    const result = isPathToDirectory([path1, path2]);

    expect(result).toBe(false);
  });

  it("should return true because the path passed is a path to a directory", () => {
    const path1 = buildPath();
    setup({
      [path1]: {},
    });

    const result = isPathToDirectory([path1]);

    expect(result).toBe(true);
  });

  it("should return false when a error occurs", () => {
    const paths = [""];

    const result = isPathToDirectory(paths);

    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "ENOENT: no such file or directory, stat ''",
      }),
    );
    (console.error as jest.Mock).mockClear();
  });
});

describe("resolveSourcePaths", () => {
  jest.spyOn(os, "homedir").mockReturnValue(buildPath());

  it("should return an empty array because there was no source parameter provided", () => {
    const mockSourceParameter = undefined;

    const result = resolveSourcePaths(mockSourceParameter);

    expect(result).toEqual([]);
  });

  it("should return an array with a single path to a file", () => {
    const path = buildPath();
    const file = buildFile({ extension: "mcap" });
    const sourceParameter = `~/${path}/${file.name}`;

    const result = resolveSourcePaths(sourceParameter);

    expect(result[0]).toContain(file.name);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("ENOENT: no such file or directory"),
      }),
    );
    (console.error as jest.Mock).mockClear();
  });

  it("should return an array with multiple paths to supported files", () => {
    const path = buildPath();
    const file1 = buildFile({ extension: "mcap" });
    const file2 = buildFile({ extension: "mcap" });
    const sourceParameter = `c:/test/${path}/${file1.name},~/${path}/${file2.name},`;

    const result = resolveSourcePaths(sourceParameter);

    expect(result[0]).toContain(file1.name);
    expect(result[1]).toContain(file2.name);
  });

  it("should return an empty array after getting a path to a directory with no mcap files", () => {
    jest.spyOn(fs, "statSync").mockReturnValueOnce({
      isDirectory: () => true,
    } as Stats);
    const path = buildPath();
    const sourceParameter = `~/${path}`;

    const result = resolveSourcePaths(sourceParameter);

    expect(result).toEqual([]);

    expect(console.error).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("ENOENT: no such file or directory"),
      }),
    );
    (console.error as jest.Mock).mockClear();
  });

  it("should return an array with mcap files after getting a path to a directory with mcap files", () => {
    const path = `/${buildPath()}`;
    const file1 = buildFile({ extension: "mcap" });
    const file2 = buildFile({ extension: "bag" });
    const file3 = buildFile({ extension: "mcap" });
    jest.spyOn(fs, "statSync").mockReturnValueOnce({
      isDirectory: () => true,
    } as Stats);
    jest
      .spyOn(fs, "readdirSync")
      .mockReturnValueOnce([file1.name, file3.name] as unknown as Dirent[]);

    setup({
      [path]: {
        [file1.name]: file1.content,
        [file2.name]: file2.content,
        [file3.name]: file1.content,
      },
    });
    const mockSourceParameter = `~${path}`;

    const result = resolveSourcePaths(mockSourceParameter);

    expect(result.length).toBe(2);
    expect(result[0]).toContain(file1.name);
    expect(result[1]).toContain(file3.name);
  });
});
