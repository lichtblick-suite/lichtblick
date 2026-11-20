// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { webglSwitches } from "./webglSwitches";

/** Electron launch args: the app dir first, then Chromium switches (GL: see `webglSwitches`). */
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
