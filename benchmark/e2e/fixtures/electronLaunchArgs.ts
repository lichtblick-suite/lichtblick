// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SWIFTSHADER_WEBGL_SWITCHES } from "./constants";

/**
 * WebGL switches for the benchmark Electron app on `platform` (verified with Electron 44.4.5):
 *
 * - `darwin`: none. With the SwiftShader switches every WebGL/WebGL2 context fails ("Could not
 *   create a WebGL context … BindToCurrentSequence failed", `getGPUFeatureStatus().webgl ===
 *   "disabled_off"`), also with `--disable-gpu-sandbox`/`--ignore-gpu-blocklist`, and every 3D
 *   panel renders its error boundary ("Error creating WebGL context."). Without switches Electron
 *   uses ANGLE Metal on the host GPU, so local macOS 3D numbers are not comparable to CI's.
 * - everything else (Linux CI, Windows): SwiftShader, see `SWIFTSHADER_WEBGL_SWITCHES`.
 *
 * The runner's error-boundary guard (`runner/errorBoundaries.ts`) fails a scenario whose panels
 * crash, so a WebGL regression here cannot go unnoticed again.
 */
export function webglSwitches(platform: NodeJS.Platform): readonly string[] {
  return platform === "darwin" ? [] : SWIFTSHADER_WEBGL_SWITCHES;
}

/** Electron launch args: the app dir first, then Chromium switches. */
export function electronLaunchArgs({
  appDir,
  platform = process.platform,
}: {
  appDir: string;
  platform?: NodeJS.Platform;
}): string[] {
  return [
    appDir,
    ...webglSwitches(platform),
    // Unquantized `performance.memory` (renderer.jsHeap.*), same as the web project.
    "--enable-precise-memory-info",
  ];
}
