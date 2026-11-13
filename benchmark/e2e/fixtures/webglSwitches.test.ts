// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ANGLE_METAL_WEBGL_SWITCHES, SWIFTSHADER_WEBGL_SWITCHES } from "./constants";
import { headlessWebglSwitches, webglSwitches } from "./webglSwitches";

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
    const all = platforms.flatMap((platform) => [
      ...webglSwitches(platform),
      ...headlessWebglSwitches(platform),
    ]);

    // Then
    expect(all).not.toContain("--in-process-gpu");
    expect(all).not.toContain("--single-process");
  });
});

describe("headlessWebglSwitches", () => {
  it("should request ANGLE Metal on macOS, the headless shell's default being SwiftShader", () => {
    // Given / When / Then
    expect(headlessWebglSwitches("darwin")).toEqual(ANGLE_METAL_WEBGL_SWITCHES);
  });

  it("should match the Electron switches elsewhere", () => {
    // Given
    const platforms: NodeJS.Platform[] = ["linux", "win32"];

    // When
    const switches = platforms.map((platform) => headlessWebglSwitches(platform));

    // Then
    expect(switches).toEqual(platforms.map((platform) => webglSwitches(platform)));
  });
});
