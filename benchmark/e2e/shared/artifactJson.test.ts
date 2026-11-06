// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { parseArtifactJson } from "./artifactJson";

describe("parseArtifactJson", () => {
  it("should return the parsed value when the file is valid JSON", () => {
    // Given
    const text = JSON.stringify({ schema: "benchmark-result.v1" });

    // When
    const parsed = parseArtifactJson<{ schema: string }>("a.benchmark-result.v1.json", text);

    // Then
    expect(parsed).toEqual({ schema: "benchmark-result.v1" });
  });

  it("should return undefined when the file is truncated", () => {
    // Given
    jest.spyOn(console, "warn").mockImplementation(() => {});

    // When
    const parsed = parseArtifactJson("a.benchmark-result.v1.json", '{"schema":');

    // Then
    expect(parsed).toBeUndefined();
  });

  it("should warn with the file name when the file is truncated", () => {
    // Given
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    // When
    parseArtifactJson("a.benchmark-result.v1.json", '{"schema":');

    // Then
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("a.benchmark-result.v1.json"));
  });
});
