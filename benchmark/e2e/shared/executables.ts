// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import { LINUX_XDG_OPEN_PATH, MACOS_OPEN_PATH } from "./constants";
import type { ExecutableCommand } from "./types";

/** Returns the first of `candidates` (absolute paths) that exists, or undefined. */
export function findExecutable(
  candidates: readonly string[],
  exists: (filePath: string) => boolean = fs.existsSync,
): string | undefined {
  return candidates.find((candidate) => exists(candidate));
}

/**
 * Command opening `file` with its default application, by absolute path: `open` on macOS,
 * `cmd /c start` from `%SystemRoot%\System32` on Windows, `xdg-open` elsewhere. Undefined on Windows
 * when `SystemRoot` is not set.
 */
export function openFileCommand(
  file: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): ExecutableCommand | undefined {
  if (platform === "darwin") {
    return { command: MACOS_OPEN_PATH, args: [file] };
  }
  if (platform === "win32") {
    const systemRoot = env.SystemRoot;
    if (systemRoot == undefined || systemRoot === "") {
      return undefined;
    }
    return {
      command: path.win32.join(systemRoot, "System32", "cmd.exe"),
      args: ["/c", "start", "", file],
    };
  }
  return { command: LINUX_XDG_OPEN_PATH, args: [file] };
}
