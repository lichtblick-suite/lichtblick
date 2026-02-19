// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "fs";

import { isFileToOpen } from "./fileUtils";

// Mock the fs module
jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock the logger to avoid actual logging during tests
jest.mock("@lichtblick/log", () => ({
  getLogger: () => ({
    error: jest.fn(),
  }),
}));

describe("isFileToOpen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when argument is a valid file", () => {
    // Mock fs.statSync to return a file stat object
    const mockStat = {
      isFile: jest.fn().mockReturnValue(true),
      isDirectory: jest.fn().mockReturnValue(false),
    } as unknown as fs.Stats;

    mockFs.statSync.mockReturnValue(mockStat);

    const result = isFileToOpen("/path/to/valid/file.txt");

    expect(result).toBe(true);
    expect(mockFs.statSync).toHaveBeenCalledWith("/path/to/valid/file.txt");
  });

  it("should return false when argument is a directory", () => {
    // Mock fs.statSync to return a directory stat object
    const mockStat = {
      isFile: jest.fn().mockReturnValue(false),
      isDirectory: jest.fn().mockReturnValue(true),
    } as unknown as fs.Stats;

    mockFs.statSync.mockReturnValue(mockStat);

    const result = isFileToOpen("/path/to/directory");

    expect(result).toBe(false);
    expect(mockFs.statSync).toHaveBeenCalledWith("/path/to/directory");
  });

  it("should return false when fs.statSync throws an error (file does not exist)", () => {
    // Mock fs.statSync to throw an error
    const error = new Error("ENOENT: no such file or directory");
    mockFs.statSync.mockImplementation(() => {
      throw error;
    });

    const result = isFileToOpen("/path/to/nonexistent/file.txt");

    expect(result).toBe(false);
    expect(mockFs.statSync).toHaveBeenCalledWith("/path/to/nonexistent/file.txt");
  });

  it("should return false when fs.statSync throws a permission error", () => {
    // Mock fs.statSync to throw a permission error
    const error = new Error("EACCES: permission denied");
    mockFs.statSync.mockImplementation(() => {
      throw error;
    });

    const result = isFileToOpen("/path/to/restricted/file.txt");

    expect(result).toBe(false);
    expect(mockFs.statSync).toHaveBeenCalledWith("/path/to/restricted/file.txt");
  });

  it("should handle empty string argument", () => {
    // Mock fs.statSync to throw an error for empty path
    const error = new Error("ENOENT: no such file or directory");
    mockFs.statSync.mockImplementation(() => {
      throw error;
    });

    const result = isFileToOpen("");

    expect(result).toBe(false);
    expect(mockFs.statSync).toHaveBeenCalledWith("");
  });

  it("should handle special characters in file path", () => {
    // Mock fs.statSync to return a file stat object
    const mockStat = {
      isFile: jest.fn().mockReturnValue(true),
      isDirectory: jest.fn().mockReturnValue(false),
    } as unknown as fs.Stats;

    mockFs.statSync.mockReturnValue(mockStat);

    const specialPath = "/path/with spaces/file-with_special.chars.txt";
    const result = isFileToOpen(specialPath);

    expect(result).toBe(true);
    expect(mockFs.statSync).toHaveBeenCalledWith(specialPath);
  });

  it("should handle relative file paths", () => {
    // Mock fs.statSync to return a file stat object
    const mockStat = {
      isFile: jest.fn().mockReturnValue(true),
      isDirectory: jest.fn().mockReturnValue(false),
    } as unknown as fs.Stats;

    mockFs.statSync.mockReturnValue(mockStat);

    const relativePath = "./relative/path/file.txt";
    const result = isFileToOpen(relativePath);

    expect(result).toBe(true);
    expect(mockFs.statSync).toHaveBeenCalledWith(relativePath);
  });

  it("should handle file paths with different extensions", () => {
    // Mock fs.statSync to return a file stat object
    const mockStat = {
      isFile: jest.fn().mockReturnValue(true),
      isDirectory: jest.fn().mockReturnValue(false),
    } as unknown as fs.Stats;

    mockFs.statSync.mockReturnValue(mockStat);

    const testCases = [
      "/path/to/file.bag",
      "/path/to/file.mcap",
      "/path/to/file.json",
      "/path/to/file.csv",
      "/path/to/file", // file without extension
    ];

    testCases.forEach((filePath) => {
      const result = isFileToOpen(filePath);
      expect(result).toBe(true);
      expect(mockFs.statSync).toHaveBeenCalledWith(filePath);
    });
  });
});
