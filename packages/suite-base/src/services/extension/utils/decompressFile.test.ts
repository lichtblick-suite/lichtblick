// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import JSZip from "jszip";

import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import decompressFile from "./decompressFile";

describe("decompressFile", () => {
  describe("Given valid zip file data", () => {
    it("When decompressing a valid zip file, Then should return JSZip instance", async () => {
      // Given
      const filename = BasicBuilder.string();
      const contentText = BasicBuilder.string();
      const zip = new JSZip();
      zip.file(filename, contentText);
      const validZipData = await zip.generateAsync({ type: "uint8array" });

      // When
      const result = await decompressFile(validZipData);

      // Then
      expect(result).toBeInstanceOf(JSZip);

      const extractedFile = result.file(filename);
      expect(extractedFile).not.toBeNull();

      const content = await extractedFile!.async("text");
      expect(content).toBe(contentText);
    });
  });

  describe("Given invalid zip file data", () => {
    it("When decompressing invalid zip data, Then should reject with error", async () => {
      // Given
      const invalidData = new Uint8Array([1, 2, 3, 4, 5]);

      // When & Then - Should reject with error
      await expect(decompressFile(invalidData)).rejects.toThrow();
    });

    it("When decompressing empty data, Then should reject with error", async () => {
      // Given
      const emptyData = new Uint8Array(0);

      // When & Then - Should reject with error
      await expect(decompressFile(emptyData)).rejects.toThrow();
    });
  });
});
