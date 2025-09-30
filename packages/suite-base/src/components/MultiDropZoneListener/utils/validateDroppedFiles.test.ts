// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { validateDropZoneItems } from "@lichtblick/suite-base/components/MultiDropZoneListener/utils/validateDroppedFiles";

describe("MultiDropZoneListener validation", () => {
  const buildFile = (name: string): File => {
    return {
      name,
      size: 1024,
      type: "",
      lastModified: Date.now(),
      slice: () => new Blob(),
      stream: () => new ReadableStream(),
      text: async () => "",
      arrayBuffer: async () => new ArrayBuffer(0),
    } as File;
  };

  const buildHandle = (name: string): FileSystemFileHandle => {
    return {
      name,
      kind: "file",
      getFile: async () => buildFile(name),
      createWritable: async () => ({}) as FileSystemWritableFileStream,
      createSyncAccessHandle: () => ({}) as FileSystemSyncAccessHandle,
      isSameEntry: async () => false,
      queryPermission: async () => "granted" as PermissionState,
      requestPermission: async () => "granted" as PermissionState,
      isFile: true,
      isDirectory: false,
    } as unknown as FileSystemFileHandle;
  };

  describe("validateDropZoneItems (unified validation)", () => {
    it("should validate mixed files and handles without duplicate messages", () => {
      const files: File[] = [buildFile("test.foxe")];
      const handles: FileSystemFileHandle[] = [buildHandle("test.foxe")];
      const result = validateDropZoneItems(files, handles, "source");

      expect(result.isValid).toBe(false);
      expect(result.validFiles).toHaveLength(0);
      expect(result.validHandles).toHaveLength(0);
      expect(result.invalidFiles).toHaveLength(1);
      expect(result.invalidHandles).toHaveLength(1);
      expect(result.errorMessage).toContain(
        'File extension ".foxe" is not allowed in Data Sources',
      );
      // Should only appear once in the message, not duplicated
      expect(
        (result.errorMessage?.match(/File extension "\.foxe" is not allowed/g) ?? []).length,
      ).toBe(1);
    });

    it("should handle files with different error types", () => {
      const files: File[] = [
        buildFile("valid.mcap"),
        buildFile("invalid.foxe"),
        buildFile("another.bag"),
      ];

      const result = validateDropZoneItems(files, undefined, "source");

      expect(result.isValid).toBe(false);
      expect(result.validFiles).toHaveLength(2);
      expect(result.invalidFiles).toHaveLength(1);
      expect(result.errorMessage).toContain(
        'File extension ".foxe" is not allowed in Data Sources',
      );
    });

    it("should validate all valid items", () => {
      const files: File[] = [buildFile("data1.mcap")];
      const handles: FileSystemFileHandle[] = [buildHandle("data2.bag")];

      const result = validateDropZoneItems(files, handles, "source");

      expect(result.isValid).toBe(true);
      expect(result.validFiles).toHaveLength(1);
      expect(result.validHandles).toHaveLength(1);
      expect(result.invalidFiles).toHaveLength(0);
      expect(result.invalidHandles).toHaveLength(0);
      expect(result.errorMessage).toBeUndefined();
    });

    it("should validate local zone with correct extensions", () => {
      const files: File[] = [buildFile("layout.json"), buildFile("extension.foxe")];

      const result = validateDropZoneItems(files, undefined, "local");

      expect(result.isValid).toBe(true);
      expect(result.validFiles).toHaveLength(2);
      expect(result.invalidFiles).toHaveLength(0);
      expect(result.errorMessage).toBeUndefined();
    });

    it("should validate org zone with correct extensions", () => {
      const files: File[] = [buildFile("config.json")];
      const handles: FileSystemFileHandle[] = [buildHandle("plugin.foxe")];

      const result = validateDropZoneItems(files, handles, "org");

      expect(result.isValid).toBe(true);
      expect(result.validFiles).toHaveLength(1);
      expect(result.validHandles).toHaveLength(1);
    });

    it("should reject invalid extensions for local/org zones", () => {
      const files: File[] = [buildFile("data.mcap")];

      const result = validateDropZoneItems(files, undefined, "local");

      expect(result.isValid).toBe(false);
      expect(result.validFiles).toHaveLength(0);
      expect(result.invalidFiles).toHaveLength(1);
      expect(result.errorMessage).toContain(
        'File extension ".mcap" is not allowed in Local Extensions or Layouts',
      );
      expect(result.errorMessage).toContain(".json, .foxe");
    });

    it("should handle multiple invalid extensions with combined error message", () => {
      const files: File[] = [buildFile("data.mcap"), buildFile("other.bag")];

      const result = validateDropZoneItems(files, undefined, "local");

      expect(result.isValid).toBe(false);
      expect(result.validFiles).toHaveLength(0);
      expect(result.invalidFiles).toHaveLength(2);
      expect(result.errorMessage).toContain(
        "2 files are not valid for Local Extensions or Layouts",
      );
    });

    it("should handle empty files and handles", () => {
      const files: File[] = [];
      const handles: FileSystemFileHandle[] | undefined = undefined;

      const result = validateDropZoneItems(files, handles, "source");

      expect(result.isValid).toBe(true);
      expect(result.validFiles).toHaveLength(0);
      expect(result.validHandles).toHaveLength(0);
      expect(result.invalidFiles).toHaveLength(0);
      expect(result.invalidHandles).toHaveLength(0);
      expect(result.errorMessage).toBeUndefined();
    });
  });
});
