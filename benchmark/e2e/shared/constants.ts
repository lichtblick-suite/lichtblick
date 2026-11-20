// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Absolute locations of the OS tools the Node-side benchmark tooling runs. Tools are invoked by
// absolute path, never looked up through `PATH` (a writable `PATH` entry could shadow them).

/** `ps` (BSD on macOS, procps on Linux): `/bin/ps`, or `/usr/bin/ps` on distros without `/bin`. */
export const PS_EXECUTABLE_CANDIDATES: readonly string[] = ["/bin/ps", "/usr/bin/ps"];

/** `git`: system install (macOS Command Line Tools shim, Linux packages), then Homebrew. */
export const GIT_EXECUTABLE_CANDIDATES: readonly string[] = [
  "/usr/bin/git",
  "/usr/local/bin/git",
  "/opt/homebrew/bin/git",
];

/** Opens a file with its default application on macOS. */
export const MACOS_OPEN_PATH = "/usr/bin/open";

/** Opens a file with its default application on Linux desktops (xdg-utils). */
export const LINUX_XDG_OPEN_PATH = "/usr/bin/xdg-open";
