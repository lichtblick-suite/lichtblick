// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ANGLE_METAL_WEBGL_SWITCHES, SWIFTSHADER_WEBGL_SWITCHES } from "./constants";

/**
 * WebGL switches of both benchmark targets on `platform` (the Electron app and the headless
 * Chromium of the web project share one GL policy, so their 3D numbers are comparable):
 *
 * - `darwin`: none. With the SwiftShader switches every WebGL/WebGL2 context of the Electron app
 *   fails ("Could not create a WebGL context … BindToCurrentSequence failed",
 *   `getGPUFeatureStatus().webgl === "disabled_off"`, verified with Electron 44.4.5), also with
 *   `--disable-gpu-sandbox`/`--ignore-gpu-blocklist`, and every 3D panel renders its error boundary
 *   ("Error creating WebGL context."). Without switches both targets use ANGLE Metal on the host
 *   GPU (headless Chromium included), so local macOS 3D numbers are not comparable to CI's.
 * - everything else (Linux CI, Windows): SwiftShader, see `SWIFTSHADER_WEBGL_SWITCHES`.
 *
 * The runner's error-boundary guard (`runner/errorBoundaries.ts`) fails a scenario whose panels
 * crash, and every result records the GL renderer actually used (`run.environment.glRenderer`).
 */
export function webglSwitches(platform: NodeJS.Platform): readonly string[] {
  return platform === "darwin" ? [] : SWIFTSHADER_WEBGL_SWITCHES;
}

/**
 * `webglSwitches` for the headless Chromium of the web project: the same GL backend as the Electron
 * app on `platform`. On macOS the headless shell needs the Metal backend requested explicitly (see
 * `ANGLE_METAL_WEBGL_SWITCHES`), otherwise it silently renders with SwiftShader.
 */
export function headlessWebglSwitches(platform: NodeJS.Platform): readonly string[] {
  return platform === "darwin" ? ANGLE_METAL_WEBGL_SWITCHES : webglSwitches(platform);
}
