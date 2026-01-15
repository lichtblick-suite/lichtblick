// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import JSZip from "jszip";

import { ALLOWED_FILES } from "@lichtblick/suite-base/services/extension/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import extractFoxeFileContent from "./extractFoxeFileContent";

describe("extractFoxeFileContent", () => {
  let zip: JSZip;
  const content: Record<string, string> = {
    [ALLOWED_FILES.EXTENSION]: BasicBuilder.string(),
    [ALLOWED_FILES.PACKAGE]: JSON.stringify(BasicBuilder.genericDictionary(String))!,
    [ALLOWED_FILES.README]: BasicBuilder.string(),
    [ALLOWED_FILES.CHANGELOG]: BasicBuilder.string(),
  };

  beforeEach(() => {
    zip = new JSZip();
    zip.file(ALLOWED_FILES.EXTENSION, content[ALLOWED_FILES.EXTENSION] ?? "");
    zip.file(ALLOWED_FILES.PACKAGE, content[ALLOWED_FILES.PACKAGE] ?? "");
    zip.file(ALLOWED_FILES.README, content[ALLOWED_FILES.README] ?? "");
    zip.file(ALLOWED_FILES.CHANGELOG, content[ALLOWED_FILES.CHANGELOG] ?? "");
  });

  it("When extracting extension.js file, Then should return the JavaScript content", async () => {
    // Given
    // When
    const result = await extractFoxeFileContent(zip, ALLOWED_FILES.EXTENSION);

    // Then
    expect(result).toBe(content[ALLOWED_FILES.EXTENSION]);
  });

  it("When extracting package.json file, Then should return the JSON content", async () => {
    // Given
    // When
    const result = await extractFoxeFileContent(zip, ALLOWED_FILES.PACKAGE);

    // Then
    expect(result).toBe(content[ALLOWED_FILES.PACKAGE]);
  });

  it("When extracting README.md file, Then should return the markdown content", async () => {
    // Given
    // When
    const result = await extractFoxeFileContent(zip, ALLOWED_FILES.README);

    // Then
    expect(result).toBe(content[ALLOWED_FILES.README]);
  });

  it("When extracting CHANGELOG.md file, Then should return the changelog content", async () => {
    // Given
    // When
    const result = await extractFoxeFileContent(zip, ALLOWED_FILES.CHANGELOG);

    // Then
    expect(result).toBe(content[ALLOWED_FILES.CHANGELOG]);
  });

  it("When extracting an empty file, Then should return empty string", async () => {
    // Given
    zip.file(ALLOWED_FILES.README, "");

    // When
    const result = await extractFoxeFileContent(zip, ALLOWED_FILES.README);

    // Then
    expect(result).toBe("");
  });

  it("When extracting a missing file, Then should return undefined", async () => {
    // Given
    const emptyZip = new JSZip();

    // When
    const result = await extractFoxeFileContent(emptyZip, ALLOWED_FILES.README);

    // Then
    expect(result).toBeUndefined();
  });
});
