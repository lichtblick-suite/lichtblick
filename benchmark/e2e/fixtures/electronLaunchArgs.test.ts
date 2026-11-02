// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SWIFTSHADER_WEBGL_SWITCHES } from "./constants";
import { electronLaunchArgs, webglSwitches } from "./electronLaunchArgs";

describe("webglSwitches", () => {
  it("forces SwiftShader on Linux (CI under xvfb) and Windows", () => {
    // Given / When / Then
    expect(webglSwitches("linux")).toEqual(SWIFTSHADER_WEBGL_SWITCHES);
    expect(webglSwitches("win32")).toEqual(SWIFTSHADER_WEBGL_SWITCHES);
  });

  it("adds no GL switches on macOS, where SwiftShader breaks WebGL", () => {
    // Given / When / Then
    expect(webglSwitches("darwin")).toEqual([]);
  });

  it("never runs the GPU in-process (crashes Electron 44 on macOS arm64)", () => {
    // Given
    const platforms: NodeJS.Platform[] = ["darwin", "linux", "win32"];

    // When
    const all = platforms.flatMap((platform) => electronLaunchArgs({ appDir: "/app", platform }));

    // Then
    expect(all).not.toContain("--in-process-gpu");
    expect(all).not.toContain("--single-process");
  });
});

describe("electronLaunchArgs", () => {
  it("puts the app dir first, then the platform's GL switches and precise memory info", () => {
    // Given
    const appDir = "/build/.webpack-desktop";

    // When
    const linux = electronLaunchArgs({ appDir, platform: "linux" });
    const darwin = electronLaunchArgs({ appDir, platform: "darwin" });

    // Then
    expect(linux).toEqual([
      appDir,
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--enable-precise-memory-info",
    ]);
    expect(darwin).toEqual([appDir, "--enable-precise-memory-info"]);
  });
});
