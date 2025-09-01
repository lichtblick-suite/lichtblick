// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "path";

import { isFileToOpen } from "./fileUtils";
import { getFilesToOpen } from "./getFilesToOpen";
import { parseCLIFlags } from "./parseCLIFlags";
import { resolveSourcePaths } from "./resolveSourcePaths";

// Mock all dependencies
jest.mock("./fileUtils");
jest.mock("./parseCLIFlags");
jest.mock("./resolveSourcePaths");

const mockIsFileToOpen = jest.mocked(isFileToOpen);
const mockParseCLIFlags = jest.mocked(parseCLIFlags);
const mockResolveSourcePaths = jest.mocked(resolveSourcePaths);

describe("getFilesToOpen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    mockIsFileToOpen.mockImplementation((filePath: string) => {
      // Mock files that should be considered valid
      return filePath.endsWith(".mcap") || filePath.endsWith(".bag");
    });
  });

  describe("files from args only", () => {
    it("should return files passed as arguments", () => {
      const argv = ["app", "file1.mcap", "file2.bag"];
      mockParseCLIFlags.mockReturnValue({});
      mockResolveSourcePaths.mockReturnValue([]);

      const result = getFilesToOpen(argv);

      const expectedFiles = [path.resolve("file1.mcap"), path.resolve("file2.bag")];
      expect(result).toEqual(expectedFiles);
      expect(mockIsFileToOpen).toHaveBeenCalledTimes(4); // 2 for args filtering + 2 for final filtering
    });

    it("should filter out invalid files from arguments", () => {
      const argv = ["app", "file1.mcap", "invalid.xyz", "file2.bag"];
      mockParseCLIFlags.mockReturnValue({});
      mockResolveSourcePaths.mockReturnValue([]);

      const result = getFilesToOpen(argv);

      const expectedFiles = [path.resolve("file1.mcap"), path.resolve("file2.bag")];
      expect(result).toEqual(expectedFiles);
    });
  });

  describe("files from --source only", () => {
    it("should return files passed via --source parameter", () => {
      const argv = ["app", "--source=source1.mcap,source2.bag"];
      mockParseCLIFlags.mockReturnValue({ source: "source1.mcap,source2.bag" });
      mockResolveSourcePaths.mockReturnValue([
        path.resolve("source1.mcap"),
        path.resolve("source2.bag"),
      ]);

      const result = getFilesToOpen(argv);

      const expectedFiles = [path.resolve("source1.mcap"), path.resolve("source2.bag")];
      expect(result).toEqual(expectedFiles);
      expect(mockResolveSourcePaths).toHaveBeenCalledWith("source1.mcap,source2.bag");
    });

    it("should handle empty --source parameter", () => {
      const argv = ["app", "--source="];
      mockParseCLIFlags.mockReturnValue({ source: "" });
      mockResolveSourcePaths.mockReturnValue([]);

      const result = getFilesToOpen(argv);

      expect(result).toEqual([]);
      expect(mockResolveSourcePaths).toHaveBeenCalledWith("");
    });

    it("should handle missing --source parameter", () => {
      const argv = ["app"];
      mockParseCLIFlags.mockReturnValue({});
      mockResolveSourcePaths.mockReturnValue([]);

      const result = getFilesToOpen(argv);

      expect(result).toEqual([]);
      expect(mockResolveSourcePaths).toHaveBeenCalledWith(undefined);
    });
  });

  describe("files from both args and --source", () => {
    it("should combine files from both arguments and --source parameter", () => {
      const argv = ["app", "arg1.mcap", "arg2.mcap", "--source=source1.mcap,source2.mcap"];
      mockParseCLIFlags.mockReturnValue({ source: "source1.mcap,source2.mcap" });
      mockResolveSourcePaths.mockReturnValue([
        path.resolve("source1.mcap"),
        path.resolve("source2.mcap"),
      ]);

      const result = getFilesToOpen(argv);

      const expectedFiles = [
        path.resolve("arg1.mcap"),
        path.resolve("arg2.mcap"),
        path.resolve("source1.mcap"),
        path.resolve("source2.mcap"),
      ];
      expect(result).toEqual(expectedFiles);
    });

    it("should remove duplicate files when same file is provided in both args and --source", () => {
      const argv = [
        "app",
        "unique1.mcap",
        "duplicated.mcap",
        "--source=duplicated.mcap,unique2.mcap",
      ];
      mockResolveSourcePaths.mockReturnValue([
        path.resolve("duplicated.mcap"),
        path.resolve("unique2.mcap"),
      ]);

      const result = getFilesToOpen(argv);

      const expectedFiles = [
        path.resolve("unique1.mcap"),
        path.resolve("duplicated.mcap"),
        path.resolve("unique2.mcap"),
      ];
      expect(result).toEqual(expectedFiles);
    });

    it("should filter out invalid files from both sources and keep valid ones", () => {
      const argv = ["app", "valid1.mcap", "invalid1.xyz", "--source=valid2.mcap,invalid2.abc"];
      mockParseCLIFlags.mockReturnValue({ source: "valid2.mcap,invalid2.abc" });
      mockResolveSourcePaths.mockReturnValue([
        path.resolve("valid2.mcap"),
        path.resolve("invalid2.abc"),
      ]);

      const result = getFilesToOpen(argv);

      const expectedFiles = [path.resolve("valid1.mcap"), path.resolve("valid2.mcap")];
      expect(result).toEqual(expectedFiles);
    });

    it("should handle complex scenario with flags, duplicates, and invalid files", () => {
      const argv = [
        "app",
        "file1.mcap",
        "--debug",
        "duplicate.bag",
        "invalid.xyz",
        "--source=duplicate.bag,file2.mcap,another-invalid.abc",
        "--verbose=true",
      ];
      mockParseCLIFlags.mockReturnValue({
        debug: "",
        source: "duplicate.bag,file2.mcap,another-invalid.abc",
        verbose: "true",
      });
      mockResolveSourcePaths.mockReturnValue([
        path.resolve("duplicate.bag"),
        path.resolve("file2.mcap"),
        path.resolve("another-invalid.abc"),
      ]);
      mockIsFileToOpen.mockImplementation((filePath: string) => {
        return (
          !filePath.includes("invalid") && (filePath.endsWith(".mcap") || filePath.endsWith(".bag"))
        );
      });

      const result = getFilesToOpen(argv);

      const expectedFiles = [
        path.resolve("file1.mcap"),
        path.resolve("duplicate.bag"),
        path.resolve("file2.mcap"),
      ];
      expect(result).toEqual(expectedFiles);
    });
  });

  describe("edge cases", () => {
    it("should handle empty argv", () => {
      const argv: string[] = [];
      mockParseCLIFlags.mockReturnValue({});
      mockResolveSourcePaths.mockReturnValue([]);

      const result = getFilesToOpen(argv);

      expect(result).toEqual([]);
    });

    it("should handle argv with only app name", () => {
      const argv = ["app"];
      mockParseCLIFlags.mockReturnValue({});
      mockResolveSourcePaths.mockReturnValue([]);

      const result = getFilesToOpen(argv);

      expect(result).toEqual([]);
    });

    it("should handle argv with only flags", () => {
      const argv = ["app", "--debug", "--verbose=true"];
      mockParseCLIFlags.mockReturnValue({ debug: "", verbose: "true" });
      mockResolveSourcePaths.mockReturnValue([]);

      const result = getFilesToOpen(argv);

      expect(result).toEqual([]);
    });

    it("should handle all files being invalid", () => {
      const argv = ["app", "invalid1.xyz", "invalid2.abc", "--source=invalid3.def"];
      mockParseCLIFlags.mockReturnValue({ source: "invalid3.def" });
      mockResolveSourcePaths.mockReturnValue([path.resolve("invalid3.def")]);
      mockIsFileToOpen.mockReturnValue(false); // All files are invalid

      const result = getFilesToOpen(argv);

      expect(result).toEqual([]);
    });

    it("should handle relative paths by converting them to absolute", () => {
      const argv = ["app", "./relative1.mcap", "../relative2.bag"];
      mockParseCLIFlags.mockReturnValue({});
      mockResolveSourcePaths.mockReturnValue([]);

      const result = getFilesToOpen(argv);

      const expectedFiles = [path.resolve("./relative1.mcap"), path.resolve("../relative2.bag")];
      expect(result).toEqual(expectedFiles);
    });

    it("should maintain order of files (args first, then source files)", () => {
      const argv = ["app", "arg1.mcap", "arg2.bag", "--source=source1.mcap,source2.mcap"];
      mockParseCLIFlags.mockReturnValue({ source: "source1.mcap,source2.mcap" });
      mockResolveSourcePaths.mockReturnValue([
        path.resolve("source1.mcap"),
        path.resolve("source2.mcap"),
      ]);

      const result = getFilesToOpen(argv);

      const expectedFiles = [
        path.resolve("arg1.mcap"),
        path.resolve("arg2.bag"),
        path.resolve("source1.mcap"),
        path.resolve("source2.mcap"),
      ];
      expect(result).toEqual(expectedFiles);
    });
  });

  describe("integration with dependencies", () => {
    it("should call parseCLIFlags with correct argv", () => {
      const argv = ["app", "file.mcap", "--debug", "--source=test.bag"];
      mockParseCLIFlags.mockReturnValue({ debug: "", source: "test.bag" });
      mockResolveSourcePaths.mockReturnValue([path.resolve("test.bag")]);

      getFilesToOpen(argv);

      expect(mockParseCLIFlags).toHaveBeenCalledWith(argv);
    });

    it("should call resolveSourcePaths with source parameter from parsed flags", () => {
      const argv = ["app", "--source=test1.mcap,test2.bag"];
      const sourceParam = "test1.mcap,test2.bag";
      mockParseCLIFlags.mockReturnValue({ source: sourceParam });
      mockResolveSourcePaths.mockReturnValue([]);

      getFilesToOpen(argv);

      expect(mockResolveSourcePaths).toHaveBeenCalledWith(sourceParam);
    });
  });
});
