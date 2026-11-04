// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Forces ANGLE's SwiftShader (CPU) backend, as `e2e/fixtures/electron.ts` does. Required on Linux:
 * under xvfb (CI, ubuntu-latest) Electron's default GL path (Mesa llvmpipe) fails WebGL context
 * creation, while SwiftShader yields WebGL 2 (ANGLE Vulkan / SwiftShader driver).
 */
export const SWIFTSHADER_WEBGL_SWITCHES: readonly string[] = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
];

/**
 * Selects ANGLE's Metal backend (host GPU) on macOS. Electron and headed Chrome use it by default;
 * Playwright's headless Chromium (`chromium-headless-shell`) instead falls back to SwiftShader unless
 * a backend is requested explicitly (verified with Chromium 148 on Apple silicon).
 */
export const ANGLE_METAL_WEBGL_SWITCHES: readonly string[] = ["--use-angle=metal"];

/** Marker switch identifying this run's browser process tree (ps fallback of the collector). */
export const RUN_MARKER_SWITCH = "--lichtblick-benchmark-run";
