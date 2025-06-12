// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { existsSync, Dirent } from "fs";
import { readFile, readdir } from "fs/promises";

import { fetchLayouts } from "./layouts";

// Mock fs methods
jest.mock("fs", () => ({
  existsSync: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}));

describe("fetchLayouts", () => {
  const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
  const mockReaddir = readdir as jest.MockedFunction<typeof readdir>;
  const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return an empty array if root folder does not exist", async () => {
    mockExistsSync.mockReturnValueOnce(false);

    const result = await fetchLayouts("/non/existent/path");

    expect(result).toEqual([]);
  });

  it("should return layouts from valid JSON files in the root folder", async () => {
    const mockFiles = [
      { name: "layout1.json", isFile: () => true },
      { name: "layout2.json", isFile: () => true },
    ];
    const mockLayout1 = { some: "data1" };
    const mockLayout2 = { some: "data2" };

    mockExistsSync.mockReturnValueOnce(true);
    mockReaddir.mockResolvedValueOnce(mockFiles as Dirent[]);
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify(mockLayout1)!)
      .mockResolvedValueOnce(JSON.stringify(mockLayout2)!);

    const result = await fetchLayouts("/valid/path");

    expect(result).toEqual([
      { from: "layout1.json", layoutJson: mockLayout1 },
      { from: "layout2.json", layoutJson: mockLayout2 },
    ]);
  });

  it("should skip non-JSON files", async () => {
    const mockFiles = [
      { name: "layout1.json", isFile: () => true },
      { name: "not_a_json.txt", isFile: () => true },
    ];
    const mockLayout1 = { some: "data1" };

    mockExistsSync.mockReturnValueOnce(true);
    mockReaddir.mockResolvedValueOnce(mockFiles as Dirent[]);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(mockLayout1)!);

    const result = await fetchLayouts("/valid/path");

    expect(result).toEqual([{ from: "layout1.json", layoutJson: mockLayout1 }]);
  });

  it("should ignore a directory end with .json in the name", async () => {
    const mockFiles = [
      { name: "layout1.json", isFile: () => true },
      { name: "folder.json", isFile: () => false },
    ];
    const mockLayout1 = { some: "data1" };

    mockExistsSync.mockReturnValueOnce(true);
    mockReaddir.mockResolvedValueOnce(mockFiles as Dirent[]);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(mockLayout1)!);

    const result = await fetchLayouts("/valid/path");

    expect(result).toEqual([{ from: "layout1.json", layoutJson: mockLayout1 }]);
  });

  it("should handle errors reading a file gracefully", async () => {
    const mockFiles = [
      { name: "layout1.json", isFile: () => true },
      { name: "layout2.json", isFile: () => true },
    ];
    const mockLayout1 = { some: "data1" };

    mockExistsSync.mockReturnValueOnce(true);
    mockReaddir.mockResolvedValueOnce(mockFiles as Dirent[]);
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify(mockLayout1)!)
      .mockRejectedValueOnce(new Error("read error"));

    const result = await fetchLayouts("/valid/path");

    expect(result).toEqual([{ from: "layout1.json", layoutJson: mockLayout1 }]);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(new Error("read error"));
    (console.error as jest.Mock).mockClear();
  });
});
