// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SWIFTSHADER_WEBGL_SWITCHES } from "./constants";
import { webglSwitches } from "./webglSwitches";

describe("webglSwitches", () => {
  it("should force SwiftShader on Linux (CI under xvfb) and Windows", () => {
    // Given / When / Then
    expect(webglSwitches("linux")).toEqual(SWIFTSHADER_WEBGL_SWITCHES);
    expect(webglSwitches("win32")).toEqual(SWIFTSHADER_WEBGL_SWITCHES);
  });

  it("should add no GL switches on macOS, where SwiftShader breaks WebGL", () => {
    // Given / When / Then
    expect(webglSwitches("darwin")).toEqual([]);
  });

  it("should never run the GPU in-process (crashes Electron 44 on macOS arm64)", () => {
    // Given
    const platforms: NodeJS.Platform[] = ["darwin", "linux", "win32"];

    // When
    const all = platforms.flatMap((platform) => [...webglSwitches(platform)]);

    // Then
    expect(all).not.toContain("--in-process-gpu");
    expect(all).not.toContain("--single-process");
  });
});
